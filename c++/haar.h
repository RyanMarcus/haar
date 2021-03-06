#ifndef HAAR_H

#ifdef JAVASCRIPT
#include <emscripten/bind.h>
#endif

#include <vector>
#include <memory>


bool haarTransform(std::vector<short>& array);
bool ihaarTransform(std::vector<short>& array);

long threshold(std::vector<short>& array, int count);
long threshold2(std::vector<short>& array, int count);
long threshold3(std::vector<short>& array, int count);

std::unique_ptr<std::vector<short>> encodeImage(
    unsigned int numChannels,
    unsigned int dim,
    std::vector<unsigned char>& data);

std::unique_ptr<std::vector<unsigned char>> decodeImage(
    std::unique_ptr<std::vector<short>> encoded,
    size_t* numChannels = NULL, size_t* dim = NULL);

#endif
