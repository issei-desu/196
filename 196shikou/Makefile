CXX = g++
CXXFLAGS = -O3 -march=native -std=c++17 -Wall -Wextra
TARGET = lychrel_196

all: $(TARGET)

$(TARGET): main.cpp
	$(CXX) $(CXXFLAGS) $< -o $@

clean:
	rm -f $(TARGET)

.PHONY: all clean
