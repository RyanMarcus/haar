#ifndef ZORDER_H
#define ZORDER_H

#include <memory>
#include <vector>

std::unique_ptr<std::vector<std::vector<short>>> decodeSFC(
    std::vector<short>& input, unsigned int dim, unsigned int smallSize);

std::unique_ptr<std::vector<short>> encodeSFC(
    std::vector<std::vector<short>>& toEnc, int smallSize);

#endif
