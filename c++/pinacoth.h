#ifndef PINACOTH_H
#define pinacoth

#include <vector>
#include <memory>

class Image {
public:
    Image(unsigned int numChannels, unsigned int dimension,
          std::unique_ptr<std::vector<unsigned char>> data)
        : numChannels(numChannels), dimension(dimension),
        data(std::move(data)) { }

    static std::unique_ptr<std::vector<unsigned char>> compressImage(
        Image& img,
        int energy);
    
    static std::unique_ptr<Image> uncompressImage(
        std::unique_ptr<std::vector<unsigned char>>);

    std::unique_ptr<std::vector<unsigned char>> getData();
    
private:
    unsigned int numChannels;
    unsigned int dimension;
    std::unique_ptr<std::vector<unsigned char>> data;
};


#endif
