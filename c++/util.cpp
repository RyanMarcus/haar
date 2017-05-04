#include "util.h"

std::unique_ptr<std::vector<unsigned char>> memToVec(
    void* data,
    size_t count) {

    unsigned char* d = (unsigned char*) data;
    std::unique_ptr<std::vector<unsigned char>> v(
        new std::vector<unsigned char>(d, d + count));
    return v;
}
