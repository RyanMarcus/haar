#include "zlib/zlib.h"
#include <memory>
#include <vector>

std::unique_ptr<std::vector<unsigned char>>  vecToRaw(
    std::vector<bool>& data) {
    

    std::unique_ptr<std::vector<unsigned char>> rdata(new std::vector<unsigned char>());


    size_t numChars = (data.size() / CHAR_BIT) + 1;
    for (unsigned int i = 0; i < numChars; i++) {
        unsigned char c = 0;
        for (int j = 0; j < CHAR_BIT; j++) {
            size_t idx = (i * CHAR_BIT) + j;
            if (idx >= data.size())
                break;

            c |= data[(i*CHAR_BIT) + j];
            c <<= 1;
        }

        rdata->push_back(c);
    }

    return rdata;
}

std::unique_ptr<std::vector<unsigned char>> compress(
    std::vector<bool>& rdata) {
    
    z_stream defstream; //deflate stream

    // don't use any custom allocators...
    defstream.zalloc = Z_NULL;
    defstream.zfree = Z_NULL;
    defstream.opaque = Z_NULL;

    std::unique_ptr<std::vector<unsigned char>> data = vecToRaw(rdata);
    unsigned char* buf = (unsigned char*) malloc(data->size());
    
    
    defstream.avail_in = data->size();
    defstream.next_in = &(data->front());
    defstream.avail_out = data->size();
    defstream.next_out = buf;

    deflateInit(&defstream, Z_BEST_COMPRESSION);
    deflate(&defstream, Z_FINISH);
    deflateEnd(&defstream);

    size_t compressedSize = defstream.total_out;

    // copy it into an appropiately sized buffer
    std::unique_ptr<std::vector<unsigned char>> toR(new std::vector<unsigned char>());

    for (unsigned int i = 0; i < compressedSize; i++) {
        toR->push_back(buf[i]);
    }

    return toR;
}



int main(int argc, char** argv) {
    std::vector<bool> data = {true, true, false, false,
                              false, false, false, false, true, true};

    std::unique_ptr<std::vector<unsigned char>> compressed =
        compress(data);

    printf("Compressed size: %ld\n", compressed->size());
}
