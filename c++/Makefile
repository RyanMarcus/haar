CC=g++
CFLAGS=-Wall -Wpedantic -std=c++11 -O3
JS_OUT=.

O_FILES=haar.o startstepstop.o
O_TEST_FILES=lodepng.o img_test.o sss_test.o

# -s DEMANGLE_SUPPORT=1


haar.js: haar.cpp
	em++ $(CFLAGS) --bind -DJAVASCRIPT -s TOTAL_MEMORY=1073741824 haar.cpp -o $(JS_OUT)/haar.js

test_haar: $(O_FILES) $(O_TEST_FILES)
	$(CC) $(CFLAGS) $(O_FILES) $(O_TEST_FILES) -o test_haar

haar.o: haar.cpp
	$(CC) $(CFLAGS) -g -c haar.cpp

startstepstop.o: startstepstop.cpp
	$(CC) $(CFLAGS) -g -c startstepstop.cpp

lodepng.o: lodepng/
	$(CC) $(CFLAGS) -g -c lodepng/lodepng.cpp

img_test.o: test/img_test.cpp
	$(CC) $(CFLAGS) -g -c test/img_test.cpp

sss_test.o: test/sss_test.cpp
	$(CC) $(CFLAGS) -g -c test/sss_test.cpp

.phony: clean test

test: test_haar
	./test_haar

test_valgrind: test_haar
	valgrind ./test_haar

clean:
	rm -f *.o haar.js test_haar

