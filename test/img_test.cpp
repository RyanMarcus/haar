// < begin copyright > 
// Copyright Ryan Marcus 2017
// 
// This file is part of haar-compression.
// 
// haar-compression is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// haar-compression is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with haar-compression.  If not, see <http://www.gnu.org/licenses/>.
// 
// < end copyright > 
 
#define CATCH_CONFIG_MAIN

#include <memory>
#include "catch.hpp"
#include "../haar.h"
#include "../lodepng/lodepng.h"

TEST_CASE("correctly reproduces a test PNG", "[2D]") {
    std::vector<unsigned char> image; //the raw pixels
    unsigned int width, height;
    
    //decode
    unsigned int error = lodepng::decode(image, width, height, "ff.png");
    
    //if there's an error, display it
    if (error)
        printf("decoder error: %s\n", lodepng_error_text(error));
    
    
    std::unique_ptr<std::vector<short>> encoded
        = encodeImage(4, width, image);

    std::unique_ptr<std::vector<unsigned char>> decoded
        = decodeImage(std::move(encoded));

    // see if the decoded image matches the image we read in...
    for (unsigned int i = 0; i < width * height; i++) {
        unsigned char dec = decoded->at(i);
        unsigned char org = image[i];

        REQUIRE(dec == org);
    }
}

TEST_CASE("correctly reproduces a small PNG", "[2D]") {
    std::vector<unsigned char> image;
    
    image.push_back(10);
    image.push_back(10);
    image.push_back(10);
    image.push_back(10);


    std::unique_ptr<std::vector<short>> encoded
        = encodeImage(1, 2, image);

    REQUIRE(encoded.size() == 6);
    
}

TEST_CASE("correctly reproduces 1D input #1", "[1D]") {
    std::vector<short> r1 = {88, 88, 89, 90, 92, 94, 96, 97};
    haarTransform(r1);

    REQUIRE(r1[1] != 88);

    ihaarTransform(r1);

    REQUIRE(r1[0] == 88);
    REQUIRE(r1[1] == 88);
    REQUIRE(r1[2] == 89);
    REQUIRE(r1[3] == 90);
    REQUIRE(r1[4] == 92);
    REQUIRE(r1[5] == 94);
    REQUIRE(r1[6] == 96);
    REQUIRE(r1[7] == 97);

}


TEST_CASE("correctly reproduces 1D input #2", "[1D]") {
    std::vector<short> r1 = {5, 10, 55, 5};
    haarTransform(r1); 

    REQUIRE(r1[0] == 18);
    REQUIRE(r1[1] == -23);
    REQUIRE(r1[2] == -5);
    REQUIRE(r1[3] == 50);

    ihaarTransform(r1);

    REQUIRE(r1[0] == 5);
    REQUIRE(r1[1] == 10);
    REQUIRE(r1[2] == 55);
    REQUIRE(r1[3] == 5);


}
