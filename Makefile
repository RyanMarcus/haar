haar.js: c++
	cd c++ && make JS_OUT=.. 

.phony: clean

clean:
	cd c++ && make clean
	rm haar.js
