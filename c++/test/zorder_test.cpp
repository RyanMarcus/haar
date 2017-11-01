#include "catch/catch.hpp"
#include "../zorder.h"


TEST_CASE("correctly encodes and decodes a test matrix", "[zorder]") {
    std::vector<std::vector<short>> k;

    for (int i = 0; i < 8; i++) {
        std::vector<short> row;
        for (int j = 0; j < 8; j++) {
            row.push_back(i*8 + j);
        }
        k.push_back(row);
    }

    auto encoded = encodeSFC(k, 4);
    auto decoded = decodeSFC(*encoded, 8, 4);


    for (int i = 0; i < 8; i++) {
        for (int j = 0; j < 8; j++) {
            REQUIRE((*decoded)[i][j] == i*8 + j);
        }
    }
}
