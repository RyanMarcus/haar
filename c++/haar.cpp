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
 

#include "haar.h"
#include "startstepstop.h"
#include "util.h"
#include <stdlib.h>
#include <stdio.h>
#include <math.h>

#define POWER_OF_2(n) (((n) & ((n) - 1)) == 0 && (n) != 0)

bool haarTransform(std::vector<short>& array) {
    
    // ensure that the array size is a power of two.
    if (! POWER_OF_2(array.size()))
        return false;

    // do the Haar transform. Replace the first half of the array
    // with the average of each pair of elements, and replace the
    // second half of the array with the differences
    // of these pairs. Then repeat this procedure on the first half
    // of the array.
    // https://www.ece.uvic.ca/~frodo/publications/phdthesis.pdf

    std::vector<short> output(array.size());
    for (size_t s = array.size(); s >= 2; s /= 2) {
        
        for (unsigned int i = 0; i < s/2; i++) {
            double v1 = array[2*i];
            double v2 = array[2*i+1];
            double avg = (v1 + v2) / 2.0;

            output[i] = floor(avg);
            output[s/2 + i] = (int)(v1 - v2);
        }


        // now copy output into the array
        for (unsigned int i = 0; i < s; i++) {
            array[i] = output[i];
        }
               
    }

    return true;
    
}

bool ihaarTransform(std::vector<short>& array) {
    // ensure that the array size is a power of 2
    if (! POWER_OF_2(array.size()))
        return false;


    // do the inverse Haar transform.
    // letting the first half of the input array be y0 and the
    // second half be y1, compute the output, x, as:
    // x[2n]   = 2 * avg / 2 (add one to this if the diff is odd)
    // x[2n+1] = x[2n] - y1[n]
    // do this recursively up to the size of the array (2, 4, 8, 16...)
    std::vector<short> output(array.size());

    for (size_t s = 2; s <= array.size(); s *= 2) {
        for (unsigned int i = 0; i < s; i++) {
            if (i % 2 == 0) {
                // even case
                int avg = array[i/2];
                int diff = array[s/2 + i/2];
                int sum = 2 * avg + (diff % 2 == 0 ? 0 : 1);
                output[i] = (sum + diff ) / 2;
            } else {
                // odd case
                output[i] = output[i-1] - array[s/2 + i/2];
            }
        }

        
        // now copy output into the array
        for (unsigned int i = 0; i < s; i++) {
            array[i] = output[i];
        }

    }


    return true;
}

bool haarTransform2D(std::vector<std::vector<short>>& data) {
    // ensure that the array size is a power of 2
    if (! POWER_OF_2(data.size()))
        return false;
    
    // transform every row, then every column.

    // first, the rows.
    for (unsigned int i = 0; i < data.size(); i++)
        if (!haarTransform(data[i])) return false;


    // the columns are harder. this kills the cache :(
    for (unsigned int i = 0; i < data.size(); i++) {
        std::vector<short> col(data.size());
        for (unsigned int j = 0; j < data.size(); j++) {
            col[j] = data[j][i];
        }

        if (!haarTransform(col)) return false;

        // and copy it back
        for (unsigned int j = 0; j < data.size(); j++) {
            data[j][i] = col[j];
        }
    }

    return true;
}

bool ihaarTransform2D(std::vector<std::vector<short>>& data) {
    // ensure that the array size is a power of 2
    if (! POWER_OF_2(data.size()))
        return false;

    // transform all the columns
    for (unsigned int i = 0; i < data.size(); i++) {
        std::vector<short> col(data.size());
        for (unsigned int j = 0; j < data.size(); j++) {
            col[j] = data[j][i];
        }

        if (!ihaarTransform(col)) return false;

        // and copy it back
        for (unsigned int j = 0; j < data.size(); j++) {
            data[j][i] = col[j];
        }

    }

    // finally all the rows
    for (unsigned int i = 0; i < data.size(); i++)
        if (!ihaarTransform(data[i])) return false;

    return true;
}


bool haarTransform2DFlat(std::vector<short>& data, int dim) {
    std::vector<std::vector<short>> d;

    for (int i = 0; i < dim; i++) {
        std::vector<short> row;
        for (int j = 0; j < dim; j++) {
            row.push_back(data[i*dim + j]);
        }

        d.push_back(row);
    }

    bool res = haarTransform2D(d);

    if (!res)
        return false;
    
    int i = 0;
    for (auto& row : d) {
        for (short s : row) {
            data[i++] = s;
        }
    }

    return true;
        
}

bool ihaarTransform2DFlat(std::vector<short>& data, int dim) {
    std::vector<std::vector<short>> d;

    for (int i = 0; i < dim; i++) {
        std::vector<short> row;
        for (int j = 0; j < dim; j++) {
            row.push_back(data[i*dim + j]);
        }

        d.push_back(row);
    }

    bool res = ihaarTransform2D(d);

    if (!res)
        return false;
    
    int i = 0;
    for (auto& row : d) {
        for (short s : row) {
            data[i++] = s;
        }
    }

    return true;
}

long threshold(std::vector<short>& s, int maxNum) {
    int removed = 0;
    long engRemoved = 0;
    for (short thres = 1; thres < 100; thres++) {
        for (unsigned int i = 2; i < s.size() && removed < maxNum; i++) {
            if (s[i] != 0 && abs(s[i]) <= thres) {
                engRemoved += abs(s[i]);
                s[i] = 0;
                removed++;
            }
        }

        if (removed == maxNum)
            return engRemoved;
    }

    return engRemoved;
}

std::unique_ptr<std::vector<short>> encodeImage(
    unsigned int numChannels,
    unsigned int dim,
    std::vector<unsigned char>& data) {
    
    // ensure the image dimension is a power of two
    if (! POWER_OF_2(dim))
        return NULL;
    
    std::vector<std::vector<std::vector<short>>> channels(numChannels);

    // copy that data from the image format into a matrix for each
    // channel
    for (unsigned int i = 0; i < dim; i++) {
        std::vector<std::vector<short>> rowChannels(numChannels);
        for (unsigned int j = 0; j < dim; j++) {
            for (unsigned int c = 0; c < numChannels; c++) {
                unsigned int idx = (j + (i * dim)) * numChannels + c;
                rowChannels[c].push_back((short)data[idx]);
            }
        }

        for (unsigned int c = 0; c < numChannels; c++) {
            channels[c].push_back(rowChannels[c]);
        }
    }

    // encode each channel
    for (auto& channel : channels)
        haarTransform2D(channel);

    std::unique_ptr<std::vector<short>> toR(new std::vector<short>());

    toR->push_back((short)numChannels);
    toR->push_back((short)dim);
    for (auto channel : channels)
        for (auto row : channel)
            for (auto val : row) {
                toR->push_back(val);
            }

    return toR;
}


std::unique_ptr<std::vector<unsigned char>> decodeImageW(
    std::unique_ptr<std::vector<short>> encoded) {
    return decodeImage(std::move(encoded), NULL, NULL);
}

std::unique_ptr<std::vector<unsigned char>> decodeImage(
    std::unique_ptr<std::vector<short>> encoded,
    size_t* ncOut, size_t* dOut) {
    std::vector<short> enc = *(encoded.get());

    int numChannels = enc[0];
    int dim = enc[1];
    
    std::vector<std::vector<std::vector<short>>> channels(numChannels);
    
    for (int c = 0; c < numChannels; c++) {
        std::vector<std::vector<short>> channel(
            dim, // number of entries
            std::vector<short>(dim) // default entry
            );
        
        for (int j = 0; j < dim*dim; j++) {
            int idx = j + (c*dim*dim) + 2;
            
            int row = j / dim;
            int col = j % dim;

            channel[row][col] = enc[idx];
        }
        channels[c] = channel;
    }

    for (auto& channel : channels)
        ihaarTransform2D(channel);

    // recombine the channels into image data
    std::unique_ptr<std::vector<unsigned char>> toR(new std::vector<unsigned char>);
    for (int i = 0; i < dim*dim; i++) {
        int row = i / dim;
        int col = i % dim;
        for (int c = 0; c < numChannels; c++) {
            short value = channels[c][row][col];
            // clamp the values
            if (value > 255)
                value = 255;
            else if (value < 0)
                value = 0;
            
            toR->push_back(value);
        }
    }


    if (ncOut != NULL)
        *ncOut = numChannels;

    if (dOut != NULL)
        *dOut = dim;
    
    return toR;
    
}



#ifdef JAVASCRIPT
using namespace emscripten;
EMSCRIPTEN_BINDINGS(my_module) {
    function("encodeImage", &encodeImage);
    function("decodeImage", &decodeImageW);
    function("haarTransform", &haarTransform);
    function("ihaarTransform", &ihaarTransform);
    function("haarTransform2D", &haarTransform2DFlat);
    function("ihaarTransform2D", &ihaarTransform2DFlat);
    function("threshold", &threshold);
    function("memToVec", &memToVec, allow_raw_pointers());
}

EMSCRIPTEN_BINDINGS(stl_wrappers) {
    register_vector<short>("VectorShort");
    register_vector<unsigned char>("VectorUChar");
}

#endif

            
