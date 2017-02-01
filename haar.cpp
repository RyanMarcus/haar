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
#include <vector>
#include <stdlib.h>
#include <stdio.h>
#include <memory>
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

    short output[array.size()];
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
    short output[array.size()];

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

int main(int argc, char** argv) {
    std::vector<short> r1 = {88, 88, 89, 90, 92, 94, 96, 97};
    std::vector<short> r2 = {90, 90, 91, 92, 93, 95, 97, 97};
    std::vector<short> r3 = {92, 92, 93, 94, 95, 96, 97, 97};
    std::vector<short> r4 = {93, 93, 94, 95, 96, 96, 96, 96};
    std::vector<short> r5 = {92, 93, 95, 96, 96, 96, 96, 95};
    std::vector<short> r6 = {92, 94, 96, 98, 99, 99, 98, 97};
    std::vector<short> r7 = {94, 96, 99, 101, 103, 103, 102, 101};
    std::vector<short> r8 = {95, 97, 101, 104, 106, 106, 105, 105};

    std::vector<std::vector<short>> mat = {r1, r2, r3, r4, r5, r6, r7, r8};
    
    
    for (std::vector<short> row : mat) {
        for (short s : row)
            printf("%d ", s);
        printf("\n");
    }


    haarTransform2D(mat);
    
    for (std::vector<short> row : mat) {
        for (short s : row)
            printf("%d ", s);
        printf("\n");
    }

    ihaarTransform2D(mat);

    for (std::vector<short> row : mat) {
        for (short s : row)
            printf("%d ", s);
        printf("\n");
    }

    /*
91 -6 -1 -3 0 -1 -2 -1 
92 -5 -1 -3 0 -1 -2 0 
94 -4 -1 -2 0 -1 -1 0 
94 -3 -1 0 0 -1 0 0 
94 -2 -3 1 -1 -1 0 1 
96 -3 -4 2 -2 -2 0 1 
99 -5 -5 2 -2 -2 0 1 
102 -6 -6 1 -2 -3 0 0 
     */
    /*
    
    std::vector<short> test = {-6, -5, -4, -3, -2, -3, -5, -6};

    for (short s : test)
        printf("%d ", s);
    printf("\n");

    haarTransform(test);


    ihaarTransform(test);


    for (short s : test)
        printf("%d ", s);
    printf("\n");
    */

            

}
