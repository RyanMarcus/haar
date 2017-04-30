haar.js: c++
	cd c++ && make JS_OUT=.. 

.phony: clean dist

clean:
	cd c++ && make clean
	rm -f haar.js haar.js.mem

dist: haar.js
	cd c++ && make clean
	rm haar.js.mem
