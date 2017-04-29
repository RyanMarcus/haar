#include "zlib/zlib.h"
#include <memory>
#include <vector>
#include <iostream>
#include <fstream>



std::unique_ptr<std::vector<unsigned char>>  vecToRaw(
    std::vector<bool>& data) {
    

    std::unique_ptr<std::vector<unsigned char>> rdata(new std::vector<unsigned char>());


    size_t numChars = (data.size() / CHAR_BIT);

    // add padding if we aren't byte aligned
    if (numChars * CHAR_BIT < data.size())
        numChars++;
    
    for (unsigned int i = 0; i < numChars; i++) {
        unsigned char c = 0;
        for (int j = 0; j < CHAR_BIT; j++) {
            c <<= 1;
            size_t idx = (i * CHAR_BIT) + j;
            
            if (idx >= data.size()) {
                // shift over the remaining bits
                c <<= (CHAR_BIT - j) - 1;
                break;
            }

            
            c |= data[(i*CHAR_BIT) + j];

        }

        rdata->push_back(c);
    }

    
    return rdata;
}

std::unique_ptr<std::vector<unsigned char>> compressVec(
    std::vector<bool>& rdata) {
    
    std::unique_ptr<std::vector<unsigned char>> data = vecToRaw(rdata);


    /*// write it out to disk
    std::ofstream f;
    f.open("ff.dat", std::ios::binary | std::ios::out);

    for (unsigned char c : *data) {
        f << c;
    }
    
    f.close();*/



    size_t bufSize = compressBound(data->size());
    unsigned char* buf = (unsigned char*) malloc(bufSize);

    compress(buf, &bufSize, &data->front(), data->size());

    // copy it into an appropiately sized buffer
    std::unique_ptr<std::vector<unsigned char>> toR(new std::vector<unsigned char>());

    for (unsigned int i = 0; i < bufSize; i++) {
        toR->push_back(buf[i]);
    }

    free(buf);
    
    return toR;
}

std::unique_ptr<std::vector<bool>> decompressVec(
    std::vector<unsigned char>& rdata) {

    // start with a 5MB buffer
    size_t bufSize = 1024 * 1024 * 5;
    unsigned char* buf = (unsigned char*) malloc(bufSize);

    uncompress(buf, &bufSize, &(rdata.front()), rdata.size());

    // copy into an approp sized buffer
    std::unique_ptr<std::vector<bool>> toR(new std::vector<bool>());

    for (unsigned int i = 0; i < bufSize; i++) {
        for (unsigned int j = 0; j < CHAR_BIT; j++) {
            unsigned char mask = 1 << (CHAR_BIT - (j+1));
            toR->push_back(buf[i] & mask);
        }
    }

    free(buf);
    return toR;
}



/*int main(int argc, char** argv) {
    std::vector<bool> data;

    data.push_back(false);
    for (int i = 0; i < 1000; i++) {
        data.push_back(true);
    }
    data.push_back(false);

    {
        std::unique_ptr<std::vector<unsigned char>> raw =
            vecToRaw(data);
        
        printf("Uncompressed size: %ld\n", raw->size());
    }
                          

    std::unique_ptr<std::vector<unsigned char>> compressed =
        compressVec(data);

    printf("Compressed size: %ld\n", compressed->size());

    std::unique_ptr<std::vector<bool>> decompressed =
        decompressVec(*compressed);

    printf("Decompressed size: %ld\n", decompressed->size()/CHAR_BIT);
    }*/
