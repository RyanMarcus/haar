#include "util.h"

std::unique_ptr<std::vector<unsigned char>> memToVec(
    unsigned char* data,
    size_t count) {

    std::unique_ptr<std::vector<unsigned char>> v(
        new std::vector<unsigned char>(data, data + count));
    return v;
}
