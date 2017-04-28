CC=g++
CFLAGS=-Wall -Wpedantic -std=c++11 -O3
JS_OUT=.

O_FILES=haar.o startstepstop.o libz.a
O_TEST_FILES=lodepng.o img_test.o sss_test.o

# -s DEMANGLE_SUPPORT=1


haar.js: haar.cpp zlibjs.a
	em++ $(CFLAGS) --bind -DJAVASCRIPT -s TOTAL_MEMORY=1073741824 zlibjs.a haar.cpp -o $(JS_OUT)/haar.js

test_haar: $(O_FILES) $(O_TEST_FILES)
	$(CC) $(CFLAGS) $(O_FILES) $(O_TEST_FILES) -o test_haar

lodepng.o: lodepng/
	$(CC) $(CFLAGS) -g -c lodepng/lodepng.cpp

%_test.o: test/%_test.cpp
	$(CC) $(CFLAGS) -g -c $< -o $@

%.o : %.cpp
	$(CC) $(CFLAGS) -g -c $< -o $@

libz.a:
	cd zlib && ./configure --static && make
	mv zlib/libz.a .

zlibjs.a: 
	cd zlib && ./configure --static && make CC=emcc
	mv zlib/libz.a zlibjs.a

.phony: clean test

test: test_haar
	./test_haar

test_valgrind: test_haar
	valgrind ./test_haar

clean:
	rm -f *.o haar.js haar.js.mem test_haar libz.a zlibjs.a
	cd zlib && make clean && rm -f configure.log


