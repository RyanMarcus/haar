#include <stdio.h>
#include <memory>
#include<vector>
#include "libmorton/morton.h"


std::unique_ptr<std::vector<std::vector<uint_fast32_t>>> multilevelSFC(
    unsigned int totalSize,
    unsigned int smallSize) {

    std::unique_ptr<std::vector<std::vector<uint_fast32_t>>> toR(
        new std::vector<std::vector<uint_fast32_t>>(totalSize)
        );

    // initialize the vector
    for (unsigned int i = 0; i < totalSize; i++) {
        (*toR)[i] = std::vector<uint_fast32_t>(totalSize);
    }

    uint_fast32_t x, y;
    for (unsigned int i = 0; i < smallSize * smallSize; i++) {
        morton2D_64_decode(i, x, y);
        (*toR)[y][x] = i;
    }

    int stripeStart = smallSize * smallSize;
    for (unsigned int d = smallSize; d < totalSize; d++) {
        if (d % 2 == 0) {
            for (y = 0; y < d; y++) {
                (*toR)[y][d] = stripeStart++;
            }
            
            for (int z = d; z >= 0; z--) {
                (*toR)[d][z] = stripeStart++;
            }
        } else {

            for (x = 0; x < d; x++) {
                (*toR)[d][x] = stripeStart++;
            }
            
            for (int z = d; z >= 0; z--) {
                (*toR)[z][d] = stripeStart++;
            }
        }
    }

    return toR;
    
}


std::unique_ptr<std::vector<short>> encodeSFC(
    std::vector<std::vector<short>>& toEnc, int smallSize) {
    
    auto sfc = multilevelSFC(toEnc.size(), smallSize);

    std::vector<std::vector<short>> temp(toEnc.size());

    // init the vector
    for (unsigned int i = 0; i < temp.size(); i++) {
        temp[i] = std::vector<short>(toEnc.size(), 0);
    }

    std::unique_ptr<std::vector<short>> toR(new std::vector<short>(
                                                toEnc.size() * toEnc.size()
                                                ));

    for (unsigned int y = 0; y < toEnc.size(); y++) {
        for (unsigned int x = 0; x < toEnc.size(); x++) {
            int idx = (*sfc)[y][x];
            short val = toEnc[y][x];
            (*toR)[idx] = val;
        }
    }
    
    return toR;
}

std::unique_ptr<std::vector<std::vector<short>>> decodeSFC(
    std::vector<short>& input, unsigned int dim, unsigned int smallSize) {

    auto sfc = multilevelSFC(dim, smallSize);
    
    std::unique_ptr<std::vector<std::vector<short>>> toR(
        new std::vector<std::vector<short>>(dim)
        );
    
    // init the vector
    for (unsigned int i = 0; i < toR->size(); i++) {
        (*toR)[i] = std::vector<short>(dim, 0);
    }

    for (unsigned int y = 0; y < dim; y++) {
        for (unsigned int x = 0; x < dim; x++) {
            int idx = (*sfc)[y][x];
            int val = input[idx];
            (*toR)[y][x] = val;
        }
    }
    

    return toR;

}

/*int main() {
    auto vec = multilevelSFC(10, 8);

    for (auto& row : *vec) {
        for (auto& col : row) {
            printf("%-4d ", col);
        }
        printf("\n");
    }
  
    }*/
