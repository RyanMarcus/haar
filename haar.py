# < begin copyright > 
# Copyright Ryan Marcus 2017
# 
# This file is part of haar-compression.
# 
# haar-compression is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# haar-compression is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
# 
# You should have received a copy of the GNU General Public License
# along with haar-compression.  If not, see <http://www.gnu.org/licenses/>.
# 
# < end copyright > 
 
import numpy as np
import math

np.set_printoptions(precision=4)

def haar_matrix(n):
    """ makes the 2d haar transform matrix for a NxN matrix. N must be a power of two. The matrix returned is orthonormal. """
    toR = np.eye(n)
    for i in range(int(np.log2(n))):
        h = np.zeros((n, n))
        stride = int(n / (2**(i+1)))

        for j in range(stride*2):
            h[j][math.floor(j/2)] = 1/2
            h[j][stride + math.floor(j/2)] = 1/2 if j % 2 == 0 else -1/2

        for j in range(stride*2, n):
            h[j][j] = 1.0

        # divide each column by its L2 norm
        h /= np.linalg.norm(h, axis=1, ord=2)
        print(h)
        toR = toR @ h

    return toR


m = haar_matrix(8)

# since the haar matrix is orthonormal, the inverse is equal to the transpose
#print(m)
#print(np.linalg.inv(m))


"""
H^T A H =  H^-1 A H = 
"""
