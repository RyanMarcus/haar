#ifndef COMRPESS_UTILS_H
#define COMRPESS_UTILS_H

std::unique_ptr<std::vector<bool>> decompressVec(
    std::vector<unsigned char>& rdata);

std::unique_ptr<std::vector<unsigned char>> compressVec(
    std::vector<bool>& rdata);

#endif
