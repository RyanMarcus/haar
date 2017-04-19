
haar: haar.o
	g++ -Wall haar.o -o haar

test_haar: haar.o lodepng.o img_test.o
	g++ -Wall haar.o lodepng.o img_test.o -o test_haar

haar.o: haar.cpp
	g++ -Wall -g -c haar.cpp 

lodepng.o: lodepng/
	g++ -Wall -g -c lodepng/lodepng.cpp

img_test.o: test/
	g++ -Wall -g -c test/img_test.cpp

.phony: clean test

test: test_haar
	./test_haar

clean:
	rm -f *.o haar test_haar

