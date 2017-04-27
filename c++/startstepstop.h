#ifndef STARTSTEPSTOP_H
#define STARTSTEPSTOP_H

#include <vector>
#include <memory>

std::unique_ptr<std::vector<bool>> encode(std::vector<short>& data);
std::unique_ptr<std::vector<short>> decode(
    std::unique_ptr<std::vector<bool>> inp);

#endif
