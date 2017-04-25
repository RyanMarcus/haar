CC=g++
CFLAGS=-Wall -Wpedantic -std=c++11
JS_OUT=.

haar.js: haar.cpp
	em++ -Wall --bind -DJAVASCRIPT haar.cpp -o $(JS_OUT)/haar.js

test_haar: haar.o lodepng.o img_test.o
	$(CC) $(CFLAGS) haar.o lodepng.o img_test.o -o test_haar

haar.o: haar.cpp
	$(CC) $(CFLAGS) -g -c haar.cpp 

lodepng.o: lodepng/
	$(CC) $(CFLAGS) -g -c lodepng/lodepng.cpp

img_test.o: test/
	$(CC) $(CFLAGS) -g -c test/img_test.cpp

.phony: clean test

test: test_haar
	./test_haar

test_valgrind: test_haar
	valgrind ./test_haar

clean:
	rm -f *.o haar.js test_haar

