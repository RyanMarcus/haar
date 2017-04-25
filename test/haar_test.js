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
            for (let i = 0; i < 10000; i++) {
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
