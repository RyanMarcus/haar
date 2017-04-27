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
#include "catch/catch.hpp"
#include "../startstepstop.h"
#include <memory>
#include <vector>
#include <random>


TEST_CASE("correctly reconstructs a small vector", "[sss]") {
    std::vector<short> s = {5, 10, -20, 31, 62};

    std::unique_ptr<std::vector<bool>> res = encode(s);
    std::unique_ptr<std::vector<short>> dec = decode(std::move(res));

    REQUIRE(dec->size() == s.size());

    for (unsigned int i = 0; i < s.size(); i++) {
        REQUIRE(s[i] == dec->at(i));
    }
}

TEST_CASE("correctly reconstructs random large vectors", "[sss]") {
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
        auto dec = decode(std::move(enc));

        REQUIRE(dec->size() == v.size());
        for (unsigned int j = 0; j < v.size(); j++) {
            REQUIRE(dec->at(j) == v[j]);
        }
        
    }
}
