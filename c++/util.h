#ifndef UTIL_H
#define UTIL_H

#include <memory>
#include <vector>

std::unique_ptr<std::vector<unsigned char>> memToVec(
    void* data,
    size_t count);


#endif
