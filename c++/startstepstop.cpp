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
 
#include "startstepstop.h"
#include <memory>
#include <vector>

// the data ranges from -255 to 255, so we need an appropiate
// (start, step, stop) code for this range.
// using the parameters (3, 2, 11), we get:
//         0 xxx               (0 - 7)
//       1 0 xxxxx             (8 - 39)
//      11 0 xxxxxxx           (40 - 167)
//     111 0 xxxxxxxxx         (168 - 679)
//     111 1 xxxxxxxxxxx       (680 - 2727)

std::unique_ptr<std::vector<bool>> encode(std::vector<short>& data) {
    std::unique_ptr<std::vector<bool>> toR(new std::vector<bool>());


    for (short s : data) {
        short us = s + 510;

        int numBits = 0;
        if (us < 0) {
            throw std::runtime_error("value out of range for start, stop, step encoder");
        } else if (us < 8) {
            toR->push_back(false);
            numBits = 3;
        } else if (us < 40) {
            toR->push_back(true);
            toR->push_back(false);
            numBits = 5;
            us -= 8;
        } else if (us < 168) {
            toR->push_back(true);
            toR->push_back(true);
            toR->push_back(false);
            numBits = 7;
            us -= 40;
            
        } else if (us < 680) {
            toR->push_back(true);
            toR->push_back(true);
            toR->push_back(true);
            toR->push_back(false);
            numBits = 9;
            us -= 168;
        } else  if (us < 2727) {
            toR->push_back(true);
            toR->push_back(true);
            toR->push_back(true);
            toR->push_back(true);
            numBits = 11;
            us -= 680;
        } else {
            throw std::runtime_error("value out of range for start, step, stop encoder");
        }


        for (int i = 0; i < numBits; i++) {
            int mask = 1 << i;
            toR->push_back(mask & us);
        }
    }

    return toR;   
}

std::unique_ptr<std::vector<short>> decode(
    std::unique_ptr<std::vector<bool>> inp) {
    std::unique_ptr<std::vector<short>> toR(new std::vector<short>);

    std::vector<bool>::iterator it = inp->begin();

    while (it != inp->end()) {
        // count the number of leading ones before a zero,
        // stopping at three.
        // TODO this assumes valid input!
        int numBits = 3;
        if (*it) {
            numBits += 2;
            it++;
        }

        if (*it) {
            numBits += 2;
            it++;
        }

        if (*it) {
            numBits += 2;
            it++;
        }

        if (*it) {
            numBits += 2;
            it++;
        }

        if (numBits != 11) {
            // eat the separating zero
            it++;
        }

        short toAdd = 0;
        for (int i = 0; i < numBits; i++) {
            if (! *it) {
                it++;
                continue;
            }

            short mask = 1;
            mask <<= i;
            toAdd |= mask;

            it++;
        }
        
        if (numBits == 5)
            toAdd += 8;
        else if (numBits == 7)
            toAdd += 40;
        else if (numBits == 9)
            toAdd += 168;
        else if (numBits == 11)
            toAdd += 680;

        toR->push_back(toAdd - 510);
    }

    return toR;
}


/*int main(int argc, char** argv) {
    std::vector<short> test;

    test.push_back(-121);

    std::unique_ptr<std::vector<bool>> res = encode(test);

    for (bool b : *res) {
        printf("%d\n", b);
    }

    std::unique_ptr<std::vector<short>> dres = decode(std::move(res));

    printf("\nresult:\n");
    
    for (short s : *dres) {
        printf("%d\n", s);
    }
    }*/
