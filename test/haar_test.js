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
 
const haar = require("../haar");
const assert = require("assert");
const seedrandom = require('seedrandom');

function vectorToArray(vec) {
    const toR = [];

    for (let i = 0; i < vec.size(); i++) {
        toR.push(vec.get(i));
    }

    return toR;
}

describe('1d', function() {
    describe('1d haar transforms', function() {
        it("should transform a four element array", function() {
            const vec = new haar.VectorShort();
            vec.push_back(5);
            vec.push_back(10);
            vec.push_back(55);
            vec.push_back(5);
            
            assert.equal(4, vec.size());
            haar.haarTransform(vec);
            assert.equal(4, vec.size());
            
            assert.equal(18, vec.get(0));
            assert.equal(-23, vec.get(1));
            assert.equal(-5, vec.get(2));
            assert.equal(50, vec.get(3));
        });
    });

    describe('1d inverse haar transforms', function() {
        it("should invert a four element array", function() {
            const vec = new haar.VectorShort();
            vec.push_back(18);
            vec.push_back(-23);
            vec.push_back(-5);
            vec.push_back(50);
            
            assert.equal(4, vec.size());
            haar.ihaarTransform(vec);
            assert.equal(4, vec.size());
            
            assert.equal(5, vec.get(0));
            assert.equal(10, vec.get(1));
            assert.equal(55, vec.get(2));
            assert.equal(5, vec.get(3));
            
        });
    });

    describe('1d transform random tests', function() {
        it("should transform and invert size 4 vectors", function() {

            const rng = seedrandom('3819831');
            for (let i = 0; i < 1000; i++) {
                const vec = new haar.VectorShort();
                const orig = [];
                for (let j = 0; j < 4; j++) {
                    const valToAdd = Math.floor(rng() * 400) - 200;
                    orig.push(valToAdd);
                    vec.push_back(valToAdd);

                }

                assert.equal(true, haar.haarTransform(vec));
                assert.notDeepEqual(orig, vectorToArray(vec));
                assert.equal(true, haar.ihaarTransform(vec));
                assert.deepEqual(orig, vectorToArray(vec));
                vec.delete();
            }
        });


        it("should transform and invert size 128 vectors", function() {

            const rng = seedrandom('3819124831');
            for (let i = 0; i < 1000; i++) {
                const vec = new haar.VectorShort();
                const orig = [];
                for (let j = 0; j < 128; j++) {
                    const valToAdd = Math.floor(rng() * 400) - 200;
                    orig.push(valToAdd);
                    vec.push_back(valToAdd);

                }

                assert.equal(true, haar.haarTransform(vec));
                assert.notDeepEqual(orig, vectorToArray(vec));
                assert.equal(true, haar.ihaarTransform(vec));
                assert.deepEqual(orig, vectorToArray(vec));
                vec.delete();
            }
        });

        it("should transform and invert arbitrary sized vectors", function () {
            const rng = seedrandom('3819831');
            for (let i = 0; i < 50; i++) {
                const vec = new haar.VectorShort();
                const orig = [];

                // pick a random power of two between 2^1 and 2^16
                const exp = Math.floor(rng() * 15) + 1;
                const size = Math.pow(2, exp);

                for (let j = 0; j < size; j++) {
                    const valToAdd = Math.floor(rng() * 400) - 200;
                    orig.push(valToAdd);
                    vec.push_back(valToAdd);
                }

                assert.equal(size, vec.size());

                assert.equal(true, haar.haarTransform(vec));
                assert.notDeepEqual(orig, vectorToArray(vec));
                assert.equal(true, haar.ihaarTransform(vec));
                assert.deepEqual(orig, vectorToArray(vec));
                vec.delete();
            }
        });
    });

    it("should reject sizes that are not a power of two", function() {
        const vec = new haar.VectorShort();

        vec.push_back(1);
        vec.push_back(1);
        vec.push_back(1);
        assert.equal(false, haar.haarTransform(vec));
        assert.equal(false, haar.ihaarTransform(vec));
        vec.push_back(1);
        vec.push_back(1);
        assert.equal(false, haar.haarTransform(vec));
        assert.equal(false, haar.ihaarTransform(vec));
        vec.push_back(1);
        assert.equal(false, haar.haarTransform(vec));
        assert.equal(false, haar.ihaarTransform(vec));
        vec.push_back(1);
        assert.equal(false, haar.haarTransform(vec));
        assert.equal(false, haar.ihaarTransform(vec));
        vec.push_back(1);
        vec.push_back(1);
        assert.equal(false, haar.haarTransform(vec));
        assert.equal(false, haar.ihaarTransform(vec));

        
        vec.delete();
    });
});

describe("image encoding & decoding", function() {
    it("can encode a simple 1 channel image", function() {
        const vec = new haar.VectorUChar();

        vec.push_back(10);
        vec.push_back(10);
        vec.push_back(10);
        vec.push_back(10);

        const encoded = haar.encodeImage(1, 2, vec);

        // the size should be the original + 2 for the dimension
        // and the number of channels
        assert.equal(6, encoded.size());

        assert.equal(1,  encoded.get(0));
        assert.equal(2,  encoded.get(1));
        assert.equal(10, encoded.get(2));
        assert.equal(0, encoded.get(3));
        assert.equal(0, encoded.get(4));
        assert.equal(0, encoded.get(5));


        const decoded = haar.decodeImage(encoded);

        assert.equal(4, decoded.size());
        assert.equal(10, decoded.get(0));
        assert.equal(10, decoded.get(1));
        assert.equal(10, decoded.get(2));
        assert.equal(10, decoded.get(3));

        vec.delete();
        decoded.delete();
    });

    it("can encode many random 32x32x4 channel image", function() {
        const rng = seedrandom('3819124831');

        for (let c = 0; c < 50; c++) {
            const vec = new haar.VectorUChar();
            
            for (let i = 0; i < 32*32*4; i++) {
                vec.push_back(Math.floor(rng() * 254));
            }
            
            const encoded = haar.encodeImage(4, 32, vec);
            assert.equal(32*32*4 + 2, encoded.size());
            assert.equal(4, encoded.get(0));
            assert.equal(32, encoded.get(1));

            const decoded = haar.decodeImage(encoded);
            
            const origArr = vectorToArray(vec);
            let transformed = vectorToArray(decoded);

            assert.equal(transformed.length, origArr.length);

            assert.deepEqual(transformed, origArr);

            decoded.delete();
            vec.delete();
        }
    });


    it("can encode a random 256x256x4 channel image", function() {
        const rng = seedrandom('3819124831');
        
        const vec = new haar.VectorUChar();
        
        for (let i = 0; i < 256*256*4; i++) {
            vec.push_back(Math.floor(rng() * 254));
        }
        
        const encoded = haar.encodeImage(4, 256, vec);
        assert.equal(256*256*4 + 2, encoded.size());
        assert.equal(4, encoded.get(0));
        assert.equal(256, encoded.get(1));

        const decoded = haar.decodeImage(encoded);
        
        const origArr = vectorToArray(vec);
        let transformed = vectorToArray(decoded);

        assert.equal(transformed.length, origArr.length);

        assert.deepEqual(transformed, origArr);

        decoded.delete();
        vec.delete();

    });

    it("can encode a random 512x512x3 channel image", function() {
        this.timeout(10000);
        const rng = seedrandom('3819124831');
        
        const vec = new haar.VectorUChar();
        
        for (let i = 0; i < 512*512*3; i++) {
            vec.push_back(Math.floor(rng() * 254));
        }
        
        const encoded = haar.encodeImage(3, 512, vec);
        assert.equal(512*512*3 + 2, encoded.size());
        assert.equal(3, encoded.get(0));
        assert.equal(512, encoded.get(1));

        const decoded = haar.decodeImage(encoded);
        
        const origArr = vectorToArray(vec);
        let transformed = vectorToArray(decoded);

        assert.equal(transformed.length, origArr.length);

        assert.deepEqual(transformed, origArr);

        decoded.delete();
        vec.delete();

    });


});
