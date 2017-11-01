#include "pinacoth.h"
#include "haar.h"
#include "startstepstop.h"
#include "compress_utils.h"

std::unique_ptr<std::vector<unsigned char>>
Image::compressImage(Image& i, int energy) {
    
    auto haarEncoded = encodeImage(i.numChannels, i.dimension, *i.data);
    threshold3(*haarEncoded, energy);
    auto sssEncoded = encode(*haarEncoded);
    auto compressed = compressVec(*sssEncoded);

    return compressed;
}

std::unique_ptr<Image> Image::uncompressImage(
    std::unique_ptr<std::vector<unsigned char>> compressed) {

    size_t dim;
    size_t channels;
    
    auto uncompressed = decompressVec(*compressed);
    auto sssDecoded = decode(std::move(uncompressed));
    auto data = decodeImage(std::move(sssDecoded), &channels, &dim);

    std::unique_ptr<Image> toR(new Image(channels, dim, std::move(data)));

    return toR;
}

std::unique_ptr<std::vector<unsigned char>> Image::getData() {
    return std::move(data);
}
