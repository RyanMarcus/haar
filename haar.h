#include <vector>
#include <memory>


bool haarTransform(std::vector<short>& array);
bool ihaarTransform(std::vector<short>& array);

std::unique_ptr<std::vector<short>> encodeImage(
    unsigned int numChannels,
    unsigned int dim,
    unsigned char* data);

std::unique_ptr<std::vector<unsigned char>> decodeImage(
    std::unique_ptr<std::vector<short>> encoded);
