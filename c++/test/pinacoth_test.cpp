#include "catch/catch.hpp"
#include "../pinacoth.h"
#include "../lodepng/lodepng.h"

TEST_CASE("correctly reproduces a test png", "[e2e]") {
    std::unique_ptr<std::vector<unsigned char>> image(
        new std::vector<unsigned char>()); //the raw pixels
    unsigned int width, height;
    
    //decode
    unsigned int error = lodepng::decode(*image, width, height, "brandeis.png");
    
    //if there's an error, display it
    if (error)
        printf("decoder error: %s\n", lodepng_error_text(error));


    // make a copy
    std::vector<unsigned char> originalImage = *image;
    
    Image img(4, width, std::move(image));

    std::unique_ptr<std::vector<unsigned char>> compressed =
        Image::compressImage(img, 0);

    printf("Original size: %ld compressed size: %ld\n",
           originalImage.size(), compressed->size());

    std::unique_ptr<Image> uncompressed = Image::uncompressImage(
        std::move(compressed));


    std::unique_ptr<std::vector<unsigned char>> decoded = uncompressed->getData();
    

    // see if the decoded image matches the image we read in...
    for (unsigned int i = 0; i < width * height * 4; i++) {
        unsigned char dec = decoded->at(i);
        unsigned char org = originalImage[i];

        // turn them into ints for printing
        int idec = dec;
        int iorg = org;
        
        REQUIRE(idec == iorg);
    }
}


TEST_CASE("correctly compresses a test png", "[e2e]") {
    std::unique_ptr<std::vector<unsigned char>> image(
        new std::vector<unsigned char>()); //the raw pixels
    unsigned int width, height;
    
    //decode
    unsigned int error = lodepng::decode(*image, width, height, "brandeis.png");
    
    //if there's an error, display it
    if (error)
        printf("decoder error: %s\n", lodepng_error_text(error));


    // make a copy
    std::vector<unsigned char> originalImage = *image;
    
    Image img(4, width, std::move(image));

    std::unique_ptr<std::vector<unsigned char>> compressed =
        Image::compressImage(img, 305000);

    printf("Original size: %ld compressed size: %ld\n",
           originalImage.size(), compressed->size());

    std::unique_ptr<Image> uncompressed = Image::uncompressImage(
        std::move(compressed));


    std::unique_ptr<std::vector<unsigned char>> decoded = uncompressed->getData();
    

    // see if the decoded image matches the image we read in...
    for (unsigned int i = 0; i < width * height * 4; i++) {
        unsigned char dec = decoded->at(i);
        unsigned char org = originalImage[i];

        // turn them into ints for printing
        int idec = dec;
        int iorg = org;
        
        REQUIRE(abs(idec - iorg) < 25);
    }
}
