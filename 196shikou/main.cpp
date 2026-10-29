#include <iostream>
#include <vector>
#include <string>
#include <fstream>
#include <chrono>
#include <csignal>
#include <algorithm>
#include <iomanip>
#include <cstring>

volatile sig_atomic_t g_stop_requested = 0;

void signal_handler(int signum) {
    (void)signum;
    g_stop_requested = 1;
}

// digits are stored in little-endian order: digits[0] is 10^0
inline bool is_palindrome(const std::vector<uint8_t>& digits) {
    size_t n = digits.size();
    const uint8_t* data = digits.data();
    for (size_t i = 0; i < n / 2; ++i) {
        if (data[i] != data[n - 1 - i]) {
            return false;
        }
    }
    return true;
}

std::string to_string_num(const std::vector<uint8_t>& digits) {
    std::string s;
    s.reserve(digits.size());
    for (auto it = digits.rbegin(); it != digits.rend(); ++it) {
        s.push_back(static_cast<char>('0' + *it));
    }
    return s;
}

std::string get_head_preview(const std::vector<uint8_t>& digits, size_t count = 50) {
    std::string s;
    size_t take = std::min(digits.size(), count);
    s.reserve(take);
    // MSB to LSB
    for (size_t i = 0; i < take; ++i) {
        s.push_back(static_cast<char>('0' + digits[digits.size() - 1 - i]));
    }
    return s;
}

std::string get_tail_preview(const std::vector<uint8_t>& digits, size_t count = 50) {
    std::string s;
    size_t take = std::min(digits.size(), count);
    s.reserve(take);
    // MSB to LSB for tail
    for (size_t i = take; i > 0; --i) {
        s.push_back(static_cast<char>('0' + digits[i - 1]));
    }
    return s;
}

void save_progress_json(const std::string& path, uint64_t step, const std::vector<uint8_t>& digits, double speed, bool is_found, const std::string& status_str) {
    auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    
    std::string tmp_path = path + ".tmp";
    std::ofstream ofs(tmp_path, std::ios::trunc);
    if (!ofs) return;

    ofs << "{\n";
    ofs << "  \"seed\": 196,\n";
    ofs << "  \"step\": " << step << ",\n";
    ofs << "  \"digits\": " << digits.size() << ",\n";
    ofs << "  \"speed\": " << std::fixed << std::setprecision(1) << speed << ",\n";
    ofs << "  \"status\": \"" << status_str << "\",\n";
    ofs << "  \"found\": " << (is_found ? "true" : "false") << ",\n";
    ofs << "  \"previewHead\": \"" << get_head_preview(digits, 60) << "\",\n";
    ofs << "  \"previewTail\": \"" << get_tail_preview(digits, 60) << "\",\n";
    ofs << "  \"updatedAt\": " << now_ms << "\n";
    ofs << "}\n";
    ofs.close();
    std::rename(tmp_path.c_str(), path.c_str());
}

void save_checkpoint(const std::string& path, uint64_t step, const std::vector<uint8_t>& digits) {
    std::string tmp_path = path + ".tmp";
    std::ofstream ofs(tmp_path, std::ios::trunc);
    if (!ofs) {
        std::cerr << "Failed to open " << tmp_path << " for writing checkpoint." << std::endl;
        return;
    }
    ofs << step << "\n";
    ofs << digits.size() << "\n";
    for (auto it = digits.rbegin(); it != digits.rend(); ++it) {
        ofs.put(static_cast<char>('0' + *it));
    }
    ofs << "\n";
    ofs.close();
    std::rename(tmp_path.c_str(), path.c_str());
}

bool load_checkpoint(const std::string& path, uint64_t& step, std::vector<uint8_t>& digits) {
    std::ifstream ifs(path);
    if (!ifs) return false;
    uint64_t loaded_step = 0;
    size_t loaded_len = 0;
    if (!(ifs >> loaded_step >> loaded_len)) return false;
    std::string num_str;
    if (!(ifs >> num_str)) return false;
    if (num_str.size() != loaded_len) {
        std::cerr << "Checkpoint length mismatch!" << std::endl;
        return false;
    }
    digits.clear();
    digits.reserve(loaded_len + 1);
    for (auto it = num_str.rbegin(); it != num_str.rend(); ++it) {
        if (*it < '0' || *it > '9') return false;
        digits.push_back(*it - '0');
    }
    step = loaded_step;
    return true;
}

int main(int argc, char* argv[]) {
    std::signal(SIGINT, signal_handler);
    std::signal(SIGTERM, signal_handler);

    const std::string checkpoint_file = "checkpoint.txt";
    const std::string result_file = "palindrome_found.txt";
    const std::string progress_file = "progress.json";

    bool force_reset = false;
    double log_interval = 2.0;
    double checkpoint_interval = 10.0;

    for (int i = 1; i < argc; ++i) {
        if (std::strcmp(argv[i], "--reset") == 0) {
            force_reset = true;
        } else if (std::strcmp(argv[i], "--log-interval") == 0 && i + 1 < argc) {
            log_interval = std::stod(argv[++i]);
        } else if (std::strcmp(argv[i], "--checkpoint-interval") == 0 && i + 1 < argc) {
            checkpoint_interval = std::stod(argv[++i]);
        } else if (std::strcmp(argv[i], "--help") == 0 || std::strcmp(argv[i], "-h") == 0) {
            std::cout << "Usage: " << argv[0] << " [options]\n"
                      << "Options:\n"
                      << "  --reset                     Start fresh from 196 (ignore checkpoint.txt)\n"
                      << "  --log-interval <sec>        Log interval in seconds (default: 2.0)\n"
                      << "  --checkpoint-interval <sec> Save checkpoint interval in seconds (default: 10.0)\n";
            return 0;
        }
    }

    uint64_t step = 0;
    std::vector<uint8_t> current;

    if (!force_reset && load_checkpoint(checkpoint_file, step, current)) {
        std::cout << "[INFO] Resumed from checkpoint: Step " << step << ", Digits: " << current.size() << std::endl;
    } else {
        current = {6, 9, 1}; // 196 in little-endian
        step = 0;
        std::cout << "[INFO] Starting fresh from 196 (Step 0)." << std::endl;
    }

    std::vector<uint8_t> next;
    auto last_log_time = std::chrono::steady_clock::now();
    auto last_checkpoint_time = last_log_time;
    uint64_t last_log_step = step;
    double current_speed = 0.0;

    save_progress_json(progress_file, step, current, 0.0, false, "running");

    std::cout << "[INFO] Running infinite trial to check if 196 reaches a palindrome..." << std::endl;

    while (!g_stop_requested) {
        step++;
        const size_t n = current.size();
        next.resize(n);

        const uint8_t* curr_ptr = current.data();
        uint8_t* next_ptr = next.data();
        uint8_t carry = 0;

        for (size_t i = 0; i < n; ++i) {
            uint8_t sum = curr_ptr[i] + curr_ptr[n - 1 - i] + carry;
            if (sum >= 10) {
                carry = 1;
                next_ptr[i] = sum - 10;
            } else {
                carry = 0;
                next_ptr[i] = sum;
            }
        }
        if (carry > 0) {
            next.push_back(carry);
        }

        current.swap(next);

        // Palindrome check
        if (is_palindrome(current)) {
            std::cout << "\n=======================================================" << std::endl;
            std::cout << " 🎉 PALINDROME DISCOVERED AT STEP " << step << "! 🎉" << std::endl;
            std::cout << " 196 IS NOT A LYCHREL NUMBER!" << std::endl;
            std::cout << " Digits count: " << current.size() << std::endl;
            std::cout << "=======================================================\n" << std::endl;

            std::ofstream ofs(result_file);
            ofs << "Step: " << step << "\n";
            ofs << "Digits count: " << current.size() << "\n";
            ofs << "Value: " << to_string_num(current) << "\n";
            ofs.close();

            save_checkpoint(checkpoint_file, step, current);
            save_progress_json(progress_file, step, current, current_speed, true, "palindrome_found");
            return 0;
        }

        // Periodic logging and checkpointing
        if ((step & 0x7FFF) == 0) { // every 32768 steps
            auto now = std::chrono::steady_clock::now();
            auto elapsed_log = std::chrono::duration<double>(now - last_log_time).count();
            if (elapsed_log >= log_interval) {
                current_speed = (step - last_log_step) / elapsed_log;
                std::cout << "Step: " << step 
                          << " | Digits: " << current.size() 
                          << " | Speed: " << std::fixed << std::setprecision(1) << current_speed << " steps/s"
                          << std::endl;
                last_log_time = now;
                last_log_step = step;
                save_progress_json(progress_file, step, current, current_speed, false, "running");
            }

            auto elapsed_cp = std::chrono::duration<double>(now - last_checkpoint_time).count();
            if (elapsed_cp >= checkpoint_interval) {
                save_checkpoint(checkpoint_file, step, current);
                last_checkpoint_time = now;
            }
        }
    }

    std::cout << "\n[INFO] Stop signal received. Saving checkpoint at step " << step << "..." << std::endl;
    save_checkpoint(checkpoint_file, step, current);
    save_progress_json(progress_file, step, current, 0.0, false, "stopped");
    std::cout << "[INFO] Checkpoint saved successfully. Process exited cleanly." << std::endl;

    return 0;
}
