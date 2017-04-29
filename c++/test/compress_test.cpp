#include "catch/catch.hpp"
#include "../compress_utils.h"
#include "../startstepstop.h"
#include <memory>
#include <vector>
#include <random>


TEST_CASE("correctly reconstruct a byte-aligned vector", "[zlib]") {
    std::vector<bool> data;

    for (int i = 0; i < 1000*8; i++) {
        data.push_back(i%2 == 0);
    }

    auto compressed = compressVec(data);

    std::unique_ptr<std::vector<bool>> recovered =
        decompressVec(*compressed);

    for (int i = 0; i < 1000*8; i++) {
        bool b = recovered->at(i);
        REQUIRE(b == (i % 2 == 0));
    }
    
}

TEST_CASE("correctly reconstruct a non-byte aligned vector", "[zlib]") {
    std::vector<bool> data;

    size_t dsize = 1000*8 + 5;
    for (unsigned int i = 0; i < dsize; i++) {
        data.push_back(i%2 == 0);
    }

    auto compressed = compressVec(data);

    std::unique_ptr<std::vector<bool>> recovered =
        decompressVec(*compressed);

    for (unsigned int i = 0; i < dsize; i++) {
        bool b = recovered->at(i);
        REQUIRE(b == (i % 2 == 0));
    }
}

TEST_CASE("correctly reconstruct start, step, stop data", "[zlib]") {
    std::vector<short> d = {-5, 100, 10, 10, 10, 3, -20};
    std::unique_ptr<std::vector<bool>> sss = encode(d);
    std::unique_ptr<std::vector<unsigned char>> zsss = compressVec(*sss);

    std::unique_ptr<std::vector<bool>> uncompressed = decompressVec(*zsss);
    std::unique_ptr<std::vector<short>> orig = decode(std::move(uncompressed));
    
    REQUIRE(orig->size() == d.size());
    for (unsigned int i = 0; i < d.size(); i++) {
        REQUIRE(orig->at(i) == d[i]);
    }
}

TEST_CASE("correctly reconstruct large random start, step, stop data", "[zlib]") {
    std::default_random_engine e1(42);
    std::uniform_int_distribution<int> d1(-510, 509);
    std::uniform_int_distribution<int> d2(1, 512*512);
    
    for (int i = 0; i < 10; i++) {
        std::vector<short> v;
        // pick a random length
        int size = d2(e1);
        
        for (int j = 0; j < size; j++) {
            v.push_back(d1(e1));
        }

        auto enc = encode(v);
        auto comp = compressVec(*enc);
        auto uncom = decompressVec(*comp);
        auto dec = decode(std::move(uncom));
        
        REQUIRE(dec->size() == v.size());
        for (unsigned int j = 0; j < v.size(); j++) {
            REQUIRE(dec->at(j) == v[j]);
        }
        
    }
}

TEST_CASE("correctly reconstruct medium random start, step, stop data", "[zlib]") {
    std::default_random_engine e1(42);
    std::uniform_int_distribution<int> d1(-510, 509);
    std::uniform_int_distribution<int> d2(1, 512);
    
    for (int i = 0; i < 1000; i++) {
        std::vector<short> v;
        // pick a random length
        int size = d2(e1);
        
        for (int j = 0; j < size; j++) {
            v.push_back(d1(e1));
        }

        auto enc = encode(v);
        auto comp = compressVec(*enc);
        auto uncom = decompressVec(*comp);
        auto dec = decode(std::move(uncom));
        
        REQUIRE(dec->size() == v.size());
        for (unsigned int j = 0; j < v.size(); j++) {
            REQUIRE(dec->at(j) == v[j]);
        }
        
    }
}
