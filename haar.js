var Module = {"ENVIRONMENT": "NODE"};

// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function read() { throw 'no read() available' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
    return value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
    } else {
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      // optimize away arguments usage in common cases
      if (sig.length === 1) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func);
        };
      } else if (sig.length === 2) {
        sigCache[func] = function dynCall_wrapper(arg) {
          return Runtime.dynCall(sig, func, [arg]);
        };
      } else {
        // general case
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
        };
      }
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { var ret = HEAP32[DYNAMICTOP_PTR>>2];var end = (((ret + size + 15)|0) & -16);HEAP32[DYNAMICTOP_PTR>>2] = end;if (end >= TOTAL_MEMORY) {var success = enlargeMemory();if (!success) {HEAP32[DYNAMICTOP_PTR>>2] = ret;return 0;}}return ret;},
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*(+4294967296))) : ((+((low>>>0)))+((+((high|0)))*(+4294967296)))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = Runtime.stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface.
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }

  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= (+1) ? (tempDouble > (+0) ? ((Math_min((+(Math_floor((tempDouble)/(+4294967296)))), (+4294967295)))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/(+4294967296))))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;


function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if (!runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

function Pointer_stringify(ptr, /* optional */ length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var __cxa_demangle_func = Module['___cxa_demangle'] || Module['__cxa_demangle'];
  if (__cxa_demangle_func) {
    try {
      var s =
        func.substr(1);
      var len = lengthBytesUTF8(s)+1;
      var buf = _malloc(len);
      stringToUTF8(s, buf, len);
      var status = _malloc(4);
      var ret = __cxa_demangle_func(buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed
    } catch(e) {
      // ignore problems here
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
    // failure when using libcxxabi, don't demangle
    return func;
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP;
var buffer;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;



function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 536870912;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools


function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
function writeStringToMemory(string, buffer, dontAddNull) {
  Runtime.warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var lastChar, end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  HEAP8.set(array, buffer);
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}


// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

if (!Math['trunc']) Math['trunc'] = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};
Math.trunc = Math['trunc'];

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function getUniqueRunDependency(id) {
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;






// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = 8;

STATICTOP = STATIC_BASE + 19648;
  /* global initializers */  __ATINIT__.push({ func: function() { __GLOBAL__sub_I_haar_cpp() } }, { func: function() { __GLOBAL__sub_I_bind_cpp() } });
  

/* memory initializer */ allocate([244,40,0,0,194,46,0,0,0,0,0,0,1,0,0,0,72,0,0,0,0,0,0,0,216,40,0,0,157,46,0,0,0,0,0,0,8,0,0,0,216,40,0,0,119,46,0,0,1,0,0,0,8,0,0,0,68,40,0,0,100,46,0,0,244,40,0,0,230,46,0,0,0,0,0,0,1,0,0,0,96,0,0,0,0,0,0,0,68,40,0,0,18,47,0,0,244,40,0,0,130,47,0,0,0,0,0,0,1,0,0,0,160,0,0,0,0,0,0,0,216,40,0,0,93,47,0,0,0,0,0,0,104,0,0,0,216,40,0,0,55,47,0,0,1,0,0,0,104,0,0,0,244,40,0,0,166,47,0,0,0,0,0,0,1,0,0,0,96,0,0,0,0,0,0,0,244,40,0,0,144,57,0,0,0,0,0,0,1,0,0,0,96,1,0,0,0,0,0,0,244,40,0,0,81,57,0,0,0,0,0,0,1,0,0,0,96,1,0,0,0,0,0,0,244,40,0,0,236,56,0,0,0,0,0,0,1,0,0,0,96,1,0,0,0,0,0,0,68,40,0,0,205,56,0,0,68,40,0,0,174,56,0,0,68,40,0,0,143,56,0,0,68,40,0,0,112,56,0,0,68,40,0,0,81,56,0,0,68,40,0,0,50,56,0,0,68,40,0,0,19,56,0,0,68,40,0,0,244,55,0,0,68,40,0,0,213,55,0,0,68,40,0,0,182,55,0,0,68,40,0,0,151,55,0,0,68,40,0,0,120,55,0,0,68,40,0,0,43,57,0,0,68,40,0,0,55,68,0,0,108,40,0,0,151,68,0,0,128,1,0,0,0,0,0,0,108,40,0,0,68,68,0,0,144,1,0,0,0,0,0,0,68,40,0,0,101,68,0,0,108,40,0,0,114,68,0,0,112,1,0,0,0,0,0,0,108,40,0,0,136,69,0,0,104,1,0,0,0,0,0,0,108,40,0,0,149,69,0,0,104,1,0,0,0,0,0,0,108,40,0,0,203,69,0,0,128,1,0,0,0,0,0,0,108,40,0,0,167,69,0,0,200,1,0,0,0,0,0,0,108,40,0,0,237,69,0,0,128,1,0,0,0,0,0,0,188,40,0,0,21,70,0,0,188,40,0,0,23,70,0,0,188,40,0,0,26,70,0,0,188,40,0,0,28,70,0,0,188,40,0,0,30,70,0,0,188,40,0,0,32,70,0,0,188,40,0,0,34,70,0,0,188,40,0,0,36,70,0,0,188,40,0,0,38,70,0,0,188,40,0,0,40,70,0,0,188,40,0,0,42,70,0,0,188,40,0,0,44,70,0,0,188,40,0,0,46,70,0,0,188,40,0,0,48,70,0,0,108,40,0,0,50,70,0,0,112,1,0,0,0,0,0,0,32,0,0,0,248,1,0,0,32,0,0,0,24,2,0,0,248,1,0,0,32,0,0,0,64,2,0,0,24,2,0,0,64,2,0,0,48,0,0,0,64,0,0,0,8,0,0,0,64,2,0,0,8,2,0,0,8,0,0,0,64,2,0,0,24,2,0,0,128,0,0,0,248,1,0,0,128,0,0,0,40,2,0,0,248,1,0,0,128,0,0,0,64,2,0,0,40,2,0,0,64,2,0,0,144,0,0,0,64,0,0,0,104,0,0,0,64,2,0,0,8,2,0,0,104,0,0,0,64,2,0,0,40,2,0,0,8,0,0,0,104,0,0,0,104,0,0,0,64,2,0,0,64,2,0,0,8,0,0,0,8,0,0,0,104,0,0,0,8,2,0,0,104,0,0,0,8,2,0,0,104,0,0,0,56,2,0,0,72,2,0,0,104,0,0,0,56,2,0,0,0,0,0,0,0,0,0,0,1,0,0,0,4,0,4,0,8,0,4,0,2,0,0,0,4,0,5,0,16,0,8,0,2,0,0,0,4,0,6,0,32,0,32,0,2,0,0,0,4,0,4,0,16,0,16,0,3,0,0,0,8,0,16,0,32,0,32,0,3,0,0,0,8,0,16,0,128,0,128,0,3,0,0,0,8,0,32,0,128,0,0,1,3,0,0,0,32,0,128,0,2,1,0,4,3,0,0,0,32,0,2,1,2,1,0,16,3,0,0,0,140,41,0,0,184,4,0,0,1,1,0,0,30,1,0,0,15,0,0,0,20,41,0,0,64,4,0,0,0,0,0,0,30,0,0,0,15,0,0,0,0,0,0,0,244,3,0,0,0,0,0,0,19,0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,3,0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,3,0,0,0,3,0,0,0,4,0,0,0,4,0,0,0,5,0,0,0,5,0,0,0,6,0,0,0,6,0,0,0,7,0,0,0,7,0,0,0,8,0,0,0,8,0,0,0,9,0,0,0,9,0,0,0,10,0,0,0,10,0,0,0,11,0,0,0,11,0,0,0,12,0,0,0,12,0,0,0,13,0,0,0,13,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,4,0,0,0,5,0,0,0,5,0,0,0,5,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,5,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,10,0,0,0,12,0,0,0,14,0,0,0,16,0,0,0,20,0,0,0,24,0,0,0,28,0,0,0,32,0,0,0,40,0,0,0,48,0,0,0,56,0,0,0,64,0,0,0,80,0,0,0,96,0,0,0,112,0,0,0,128,0,0,0,160,0,0,0,192,0,0,0,224,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,6,0,0,0,8,0,0,0,12,0,0,0,16,0,0,0,24,0,0,0,32,0,0,0,48,0,0,0,64,0,0,0,96,0,0,0,128,0,0,0,192,0,0,0,0,1,0,0,128,1,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,6,0,0,0,8,0,0,0,12,0,0,0,16,0,0,0,24,0,0,0,32,0,0,0,48,0,0,0,64,0,0,0,96,0,0,231,51,0,0,247,51,0,0,160,72,0,0,2,52,0,0,13,52,0,0,26,52,0,0,37,52,0,0,57,52,0,0,70,52,0,0,160,72,0,0,0,0,0,0,150,48,7,119,44,97,14,238,186,81,9,153,25,196,109,7,143,244,106,112,53,165,99,233,163,149,100,158,50,136,219,14,164,184,220,121,30,233,213,224,136,217,210,151,43,76,182,9,189,124,177,126,7,45,184,231,145,29,191,144,100,16,183,29,242,32,176,106,72,113,185,243,222,65,190,132,125,212,218,26,235,228,221,109,81,181,212,244,199,133,211,131,86,152,108,19,192,168,107,100,122,249,98,253,236,201,101,138,79,92,1,20,217,108,6,99,99,61,15,250,245,13,8,141,200,32,110,59,94,16,105,76,228,65,96,213,114,113,103,162,209,228,3,60,71,212,4,75,253,133,13,210,107,181,10,165,250,168,181,53,108,152,178,66,214,201,187,219,64,249,188,172,227,108,216,50,117,92,223,69,207,13,214,220,89,61,209,171,172,48,217,38,58,0,222,81,128,81,215,200,22,97,208,191,181,244,180,33,35,196,179,86,153,149,186,207,15,165,189,184,158,184,2,40,8,136,5,95,178,217,12,198,36,233,11,177,135,124,111,47,17,76,104,88,171,29,97,193,61,45,102,182,144,65,220,118,6,113,219,1,188,32,210,152,42,16,213,239,137,133,177,113,31,181,182,6,165,228,191,159,51,212,184,232,162,201,7,120,52,249,0,15,142,168,9,150,24,152,14,225,187,13,106,127,45,61,109,8,151,108,100,145,1,92,99,230,244,81,107,107,98,97,108,28,216,48,101,133,78,0,98,242,237,149,6,108,123,165,1,27,193,244,8,130,87,196,15,245,198,217,176,101,80,233,183,18,234,184,190,139,124,136,185,252,223,29,221,98,73,45,218,21,243,124,211,140,101,76,212,251,88,97,178,77,206,81,181,58,116,0,188,163,226,48,187,212,65,165,223,74,215,149,216,61,109,196,209,164,251,244,214,211,106,233,105,67,252,217,110,52,70,136,103,173,208,184,96,218,115,45,4,68,229,29,3,51,95,76,10,170,201,124,13,221,60,113,5,80,170,65,2,39,16,16,11,190,134,32,12,201,37,181,104,87,179,133,111,32,9,212,102,185,159,228,97,206,14,249,222,94,152,201,217,41,34,152,208,176,180,168,215,199,23,61,179,89,129,13,180,46,59,92,189,183,173,108,186,192,32,131,184,237,182,179,191,154,12,226,182,3,154,210,177,116,57,71,213,234,175,119,210,157,21,38,219,4,131,22,220,115,18,11,99,227,132,59,100,148,62,106,109,13,168,90,106,122,11,207,14,228,157,255,9,147,39,174,0,10,177,158,7,125,68,147,15,240,210,163,8,135,104,242,1,30,254,194,6,105,93,87,98,247,203,103,101,128,113,54,108,25,231,6,107,110,118,27,212,254,224,43,211,137,90,122,218,16,204,74,221,103,111,223,185,249,249,239,190,142,67,190,183,23,213,142,176,96,232,163,214,214,126,147,209,161,196,194,216,56,82,242,223,79,241,103,187,209,103,87,188,166,221,6,181,63,75,54,178,72,218,43,13,216,76,27,10,175,246,74,3,54,96,122,4,65,195,239,96,223,85,223,103,168,239,142,110,49,121,190,105,70,140,179,97,203,26,131,102,188,160,210,111,37,54,226,104,82,149,119,12,204,3,71,11,187,185,22,2,34,47,38,5,85,190,59,186,197,40,11,189,178,146,90,180,43,4,106,179,92,167,255,215,194,49,207,208,181,139,158,217,44,29,174,222,91,176,194,100,155,38,242,99,236,156,163,106,117,10,147,109,2,169,6,9,156,63,54,14,235,133,103,7,114,19,87,0,5,130,74,191,149,20,122,184,226,174,43,177,123,56,27,182,12,155,142,210,146,13,190,213,229,183,239,220,124,33,223,219,11,212,210,211,134,66,226,212,241,248,179,221,104,110,131,218,31,205,22,190,129,91,38,185,246,225,119,176,111,119,71,183,24,230,90,8,136,112,106,15,255,202,59,6,102,92,11,1,17,255,158,101,143,105,174,98,248,211,255,107,97,69,207,108,22,120,226,10,160,238,210,13,215,84,131,4,78,194,179,3,57,97,38,103,167,247,22,96,208,77,71,105,73,219,119,110,62,74,106,209,174,220,90,214,217,102,11,223,64,240,59,216,55,83,174,188,169,197,158,187,222,127,207,178,71,233,255,181,48,28,242,189,189,138,194,186,202,48,147,179,83,166,163,180,36,5,54,208,186,147,6,215,205,41,87,222,84,191,103,217,35,46,122,102,179,184,74,97,196,2,27,104,93,148,43,111,42,55,190,11,180,161,142,12,195,27,223,5,90,141,239,2,45,0,0,0,0,65,49,27,25,130,98,54,50,195,83,45,43,4,197,108,100,69,244,119,125,134,167,90,86,199,150,65,79,8,138,217,200,73,187,194,209,138,232,239,250,203,217,244,227,12,79,181,172,77,126,174,181,142,45,131,158,207,28,152,135,81,18,194,74,16,35,217,83,211,112,244,120,146,65,239,97,85,215,174,46,20,230,181,55,215,181,152,28,150,132,131,5,89,152,27,130,24,169,0,155,219,250,45,176,154,203,54,169,93,93,119,230,28,108,108,255,223,63,65,212,158,14,90,205,162,36,132,149,227,21,159,140,32,70,178,167,97,119,169,190,166,225,232,241,231,208,243,232,36,131,222,195,101,178,197,218,170,174,93,93,235,159,70,68,40,204,107,111,105,253,112,118,174,107,49,57,239,90,42,32,44,9,7,11,109,56,28,18,243,54,70,223,178,7,93,198,113,84,112,237,48,101,107,244,247,243,42,187,182,194,49,162,117,145,28,137,52,160,7,144,251,188,159,23,186,141,132,14,121,222,169,37,56,239,178,60,255,121,243,115,190,72,232,106,125,27,197,65,60,42,222,88,5,79,121,240,68,126,98,233,135,45,79,194,198,28,84,219,1,138,21,148,64,187,14,141,131,232,35,166,194,217,56,191,13,197,160,56,76,244,187,33,143,167,150,10,206,150,141,19,9,0,204,92,72,49,215,69,139,98,250,110,202,83,225,119,84,93,187,186,21,108,160,163,214,63,141,136,151,14,150,145,80,152,215,222,17,169,204,199,210,250,225,236,147,203,250,245,92,215,98,114,29,230,121,107,222,181,84,64,159,132,79,89,88,18,14,22,25,35,21,15,218,112,56,36,155,65,35,61,167,107,253,101,230,90,230,124,37,9,203,87,100,56,208,78,163,174,145,1,226,159,138,24,33,204,167,51,96,253,188,42,175,225,36,173,238,208,63,180,45,131,18,159,108,178,9,134,171,36,72,201,234,21,83,208,41,70,126,251,104,119,101,226,246,121,63,47,183,72,36,54,116,27,9,29,53,42,18,4,242,188,83,75,179,141,72,82,112,222,101,121,49,239,126,96,254,243,230,231,191,194,253,254,124,145,208,213,61,160,203,204,250,54,138,131,187,7,145,154,120,84,188,177,57,101,167,168,75,152,131,59,10,169,152,34,201,250,181,9,136,203,174,16,79,93,239,95,14,108,244,70,205,63,217,109,140,14,194,116,67,18,90,243,2,35,65,234,193,112,108,193,128,65,119,216,71,215,54,151,6,230,45,142,197,181,0,165,132,132,27,188,26,138,65,113,91,187,90,104,152,232,119,67,217,217,108,90,30,79,45,21,95,126,54,12,156,45,27,39,221,28,0,62,18,0,152,185,83,49,131,160,144,98,174,139,209,83,181,146,22,197,244,221,87,244,239,196,148,167,194,239,213,150,217,246,233,188,7,174,168,141,28,183,107,222,49,156,42,239,42,133,237,121,107,202,172,72,112,211,111,27,93,248,46,42,70,225,225,54,222,102,160,7,197,127,99,84,232,84,34,101,243,77,229,243,178,2,164,194,169,27,103,145,132,48,38,160,159,41,184,174,197,228,249,159,222,253,58,204,243,214,123,253,232,207,188,107,169,128,253,90,178,153,62,9,159,178,127,56,132,171,176,36,28,44,241,21,7,53,50,70,42,30,115,119,49,7,180,225,112,72,245,208,107,81,54,131,70,122,119,178,93,99,78,215,250,203,15,230,225,210,204,181,204,249,141,132,215,224,74,18,150,175,11,35,141,182,200,112,160,157,137,65,187,132,70,93,35,3,7,108,56,26,196,63,21,49,133,14,14,40,66,152,79,103,3,169,84,126,192,250,121,85,129,203,98,76,31,197,56,129,94,244,35,152,157,167,14,179,220,150,21,170,27,0,84,229,90,49,79,252,153,98,98,215,216,83,121,206,23,79,225,73,86,126,250,80,149,45,215,123,212,28,204,98,19,138,141,45,82,187,150,52,145,232,187,31,208,217,160,6,236,243,126,94,173,194,101,71,110,145,72,108,47,160,83,117,232,54,18,58,169,7,9,35,106,84,36,8,43,101,63,17,228,121,167,150,165,72,188,143,102,27,145,164,39,42,138,189,224,188,203,242,161,141,208,235,98,222,253,192,35,239,230,217,189,225,188,20,252,208,167,13,63,131,138,38,126,178,145,63,185,36,208,112,248,21,203,105,59,70,230,66,122,119,253,91,181,107,101,220,244,90,126,197,55,9,83,238,118,56,72,247,177,174,9,184,240,159,18,161,51,204,63,138,114,253,36,147,0,0,0,0,55,106,194,1,110,212,132,3,89,190,70,2,220,168,9,7,235,194,203,6,178,124,141,4,133,22,79,5,184,81,19,14,143,59,209,15,214,133,151,13,225,239,85,12,100,249,26,9,83,147,216,8,10,45,158,10,61,71,92,11,112,163,38,28,71,201,228,29,30,119,162,31,41,29,96,30,172,11,47,27,155,97,237,26,194,223,171,24,245,181,105,25,200,242,53,18,255,152,247,19,166,38,177,17,145,76,115,16,20,90,60,21,35,48,254,20,122,142,184,22,77,228,122,23,224,70,77,56,215,44,143,57,142,146,201,59,185,248,11,58,60,238,68,63,11,132,134,62,82,58,192,60,101,80,2,61,88,23,94,54,111,125,156,55,54,195,218,53,1,169,24,52,132,191,87,49,179,213,149,48,234,107,211,50,221,1,17,51,144,229,107,36,167,143,169,37,254,49,239,39,201,91,45,38,76,77,98,35,123,39,160,34,34,153,230,32,21,243,36,33,40,180,120,42,31,222,186,43,70,96,252,41,113,10,62,40,244,28,113,45,195,118,179,44,154,200,245,46,173,162,55,47,192,141,154,112,247,231,88,113,174,89,30,115,153,51,220,114,28,37,147,119,43,79,81,118,114,241,23,116,69,155,213,117,120,220,137,126,79,182,75,127,22,8,13,125,33,98,207,124,164,116,128,121,147,30,66,120,202,160,4,122,253,202,198,123,176,46,188,108,135,68,126,109,222,250,56,111,233,144,250,110,108,134,181,107,91,236,119,106,2,82,49,104,53,56,243,105,8,127,175,98,63,21,109,99,102,171,43,97,81,193,233,96,212,215,166,101,227,189,100,100,186,3,34,102,141,105,224,103,32,203,215,72,23,161,21,73,78,31,83,75,121,117,145,74,252,99,222,79,203,9,28,78,146,183,90,76,165,221,152,77,152,154,196,70,175,240,6,71,246,78,64,69,193,36,130,68,68,50,205,65,115,88,15,64,42,230,73,66,29,140,139,67,80,104,241,84,103,2,51,85,62,188,117,87,9,214,183,86,140,192,248,83,187,170,58,82,226,20,124,80,213,126,190,81,232,57,226,90,223,83,32,91,134,237,102,89,177,135,164,88,52,145,235,93,3,251,41,92,90,69,111,94,109,47,173,95,128,27,53,225,183,113,247,224,238,207,177,226,217,165,115,227,92,179,60,230,107,217,254,231,50,103,184,229,5,13,122,228,56,74,38,239,15,32,228,238,86,158,162,236,97,244,96,237,228,226,47,232,211,136,237,233,138,54,171,235,189,92,105,234,240,184,19,253,199,210,209,252,158,108,151,254,169,6,85,255,44,16,26,250,27,122,216,251,66,196,158,249,117,174,92,248,72,233,0,243,127,131,194,242,38,61,132,240,17,87,70,241,148,65,9,244,163,43,203,245,250,149,141,247,205,255,79,246,96,93,120,217,87,55,186,216,14,137,252,218,57,227,62,219,188,245,113,222,139,159,179,223,210,33,245,221,229,75,55,220,216,12,107,215,239,102,169,214,182,216,239,212,129,178,45,213,4,164,98,208,51,206,160,209,106,112,230,211,93,26,36,210,16,254,94,197,39,148,156,196,126,42,218,198,73,64,24,199,204,86,87,194,251,60,149,195,162,130,211,193,149,232,17,192,168,175,77,203,159,197,143,202,198,123,201,200,241,17,11,201,116,7,68,204,67,109,134,205,26,211,192,207,45,185,2,206,64,150,175,145,119,252,109,144,46,66,43,146,25,40,233,147,156,62,166,150,171,84,100,151,242,234,34,149,197,128,224,148,248,199,188,159,207,173,126,158,150,19,56,156,161,121,250,157,36,111,181,152,19,5,119,153,74,187,49,155,125,209,243,154,48,53,137,141,7,95,75,140,94,225,13,142,105,139,207,143,236,157,128,138,219,247,66,139,130,73,4,137,181,35,198,136,136,100,154,131,191,14,88,130,230,176,30,128,209,218,220,129,84,204,147,132,99,166,81,133,58,24,23,135,13,114,213,134,160,208,226,169,151,186,32,168,206,4,102,170,249,110,164,171,124,120,235,174,75,18,41,175,18,172,111,173,37,198,173,172,24,129,241,167,47,235,51,166,118,85,117,164,65,63,183,165,196,41,248,160,243,67,58,161,170,253,124,163,157,151,190,162,208,115,196,181,231,25,6,180,190,167,64,182,137,205,130,183,12,219,205,178,59,177,15,179,98,15,73,177,85,101,139,176,104,34,215,187,95,72,21,186,6,246,83,184,49,156,145,185,180,138,222,188,131,224,28,189,218,94,90,191,237,52,152,190,0,0,0,0,101,103,188,184,139,200,9,170,238,175,181,18,87,151,98,143,50,240,222,55,220,95,107,37,185,56,215,157,239,40,180,197,138,79,8,125,100,224,189,111,1,135,1,215,184,191,214,74,221,216,106,242,51,119,223,224,86,16,99,88,159,87,25,80,250,48,165,232,20,159,16,250,113,248,172,66,200,192,123,223,173,167,199,103,67,8,114,117,38,111,206,205,112,127,173,149,21,24,17,45,251,183,164,63,158,208,24,135,39,232,207,26,66,143,115,162,172,32,198,176,201,71,122,8,62,175,50,160,91,200,142,24,181,103,59,10,208,0,135,178,105,56,80,47,12,95,236,151,226,240,89,133,135,151,229,61,209,135,134,101,180,224,58,221,90,79,143,207,63,40,51,119,134,16,228,234,227,119,88,82,13,216,237,64,104,191,81,248,161,248,43,240,196,159,151,72,42,48,34,90,79,87,158,226,246,111,73,127,147,8,245,199,125,167,64,213,24,192,252,109,78,208,159,53,43,183,35,141,197,24,150,159,160,127,42,39,25,71,253,186,124,32,65,2,146,143,244,16,247,232,72,168,61,88,20,155,88,63,168,35,182,144,29,49,211,247,161,137,106,207,118,20,15,168,202,172,225,7,127,190,132,96,195,6,210,112,160,94,183,23,28,230,89,184,169,244,60,223,21,76,133,231,194,209,224,128,126,105,14,47,203,123,107,72,119,195,162,15,13,203,199,104,177,115,41,199,4,97,76,160,184,217,245,152,111,68,144,255,211,252,126,80,102,238,27,55,218,86,77,39,185,14,40,64,5,182,198,239,176,164,163,136,12,28,26,176,219,129,127,215,103,57,145,120,210,43,244,31,110,147,3,247,38,59,102,144,154,131,136,63,47,145,237,88,147,41,84,96,68,180,49,7,248,12,223,168,77,30,186,207,241,166,236,223,146,254,137,184,46,70,103,23,155,84,2,112,39,236,187,72,240,113,222,47,76,201,48,128,249,219,85,231,69,99,156,160,63,107,249,199,131,211,23,104,54,193,114,15,138,121,203,55,93,228,174,80,225,92,64,255,84,78,37,152,232,246,115,136,139,174,22,239,55,22,248,64,130,4,157,39,62,188,36,31,233,33,65,120,85,153,175,215,224,139,202,176,92,51,59,182,89,237,94,209,229,85,176,126,80,71,213,25,236,255,108,33,59,98,9,70,135,218,231,233,50,200,130,142,142,112,212,158,237,40,177,249,81,144,95,86,228,130,58,49,88,58,131,9,143,167,230,110,51,31,8,193,134,13,109,166,58,181,164,225,64,189,193,134,252,5,47,41,73,23,74,78,245,175,243,118,34,50,150,17,158,138,120,190,43,152,29,217,151,32,75,201,244,120,46,174,72,192,192,1,253,210,165,102,65,106,28,94,150,247,121,57,42,79,151,150,159,93,242,241,35,229,5,25,107,77,96,126,215,245,142,209,98,231,235,182,222,95,82,142,9,194,55,233,181,122,217,70,0,104,188,33,188,208,234,49,223,136,143,86,99,48,97,249,214,34,4,158,106,154,189,166,189,7,216,193,1,191,54,110,180,173,83,9,8,21,154,78,114,29,255,41,206,165,17,134,123,183,116,225,199,15,205,217,16,146,168,190,172,42,70,17,25,56,35,118,165,128,117,102,198,216,16,1,122,96,254,174,207,114,155,201,115,202,34,241,164,87,71,150,24,239,169,57,173,253,204,94,17,69,6,238,77,118,99,137,241,206,141,38,68,220,232,65,248,100,81,121,47,249,52,30,147,65,218,177,38,83,191,214,154,235,233,198,249,179,140,161,69,11,98,14,240,25,7,105,76,161,190,81,155,60,219,54,39,132,53,153,146,150,80,254,46,46,153,185,84,38,252,222,232,158,18,113,93,140,119,22,225,52,206,46,54,169,171,73,138,17,69,230,63,3,32,129,131,187,118,145,224,227,19,246,92,91,253,89,233,73,152,62,85,241,33,6,130,108,68,97,62,212,170,206,139,198,207,169,55,126,56,65,127,214,93,38,195,110,179,137,118,124,214,238,202,196,111,214,29,89,10,177,161,225,228,30,20,243,129,121,168,75,215,105,203,19,178,14,119,171,92,161,194,185,57,198,126,1,128,254,169,156,229,153,21,36,11,54,160,54,110,81,28,142,167,22,102,134,194,113,218,62,44,222,111,44,73,185,211,148,240,129,4,9,149,230,184,177,123,73,13,163,30,46,177,27,72,62,210,67,45,89,110,251,195,246,219,233,166,145,103,81,31,169,176,204,122,206,12,116,148,97,185,102,241,6,5,222,0,0,0,0,119,7,48,150,238,14,97,44,153,9,81,186,7,109,196,25,112,106,244,143,233,99,165,53,158,100,149,163,14,219,136,50,121,220,184,164,224,213,233,30,151,210,217,136,9,182,76,43,126,177,124,189,231,184,45,7,144,191,29,145,29,183,16,100,106,176,32,242,243,185,113,72,132,190,65,222,26,218,212,125,109,221,228,235,244,212,181,81,131,211,133,199,19,108,152,86,100,107,168,192,253,98,249,122,138,101,201,236,20,1,92,79,99,6,108,217,250,15,61,99,141,8,13,245,59,110,32,200,76,105,16,94,213,96,65,228,162,103,113,114,60,3,228,209,75,4,212,71,210,13,133,253,165,10,181,107,53,181,168,250,66,178,152,108,219,187,201,214,172,188,249,64,50,216,108,227,69,223,92,117,220,214,13,207,171,209,61,89,38,217,48,172,81,222,0,58,200,215,81,128,191,208,97,22,33,180,244,181,86,179,196,35,207,186,149,153,184,189,165,15,40,2,184,158,95,5,136,8,198,12,217,178,177,11,233,36,47,111,124,135,88,104,76,17,193,97,29,171,182,102,45,61,118,220,65,144,1,219,113,6,152,210,32,188,239,213,16,42,113,177,133,137,6,182,181,31,159,191,228,165,232,184,212,51,120,7,201,162,15,0,249,52,150,9,168,142,225,14,152,24,127,106,13,187,8,109,61,45,145,100,108,151,230,99,92,1,107,107,81,244,28,108,97,98,133,101,48,216,242,98,0,78,108,6,149,237,27,1,165,123,130,8,244,193,245,15,196,87,101,176,217,198,18,183,233,80,139,190,184,234,252,185,136,124,98,221,29,223,21,218,45,73,140,211,124,243,251,212,76,101,77,178,97,88,58,181,81,206,163,188,0,116,212,187,48,226,74,223,165,65,61,216,149,215,164,209,196,109,211,214,244,251,67,105,233,106,52,110,217,252,173,103,136,70,218,96,184,208,68,4,45,115,51,3,29,229,170,10,76,95,221,13,124,201,80,5,113,60,39,2,65,170,190,11,16,16,201,12,32,134,87,104,181,37,32,111,133,179,185,102,212,9,206,97,228,159,94,222,249,14,41,217,201,152,176,208,152,34,199,215,168,180,89,179,61,23,46,180,13,129,183,189,92,59,192,186,108,173,237,184,131,32,154,191,179,182,3,182,226,12,116,177,210,154,234,213,71,57,157,210,119,175,4,219,38,21,115,220,22,131,227,99,11,18,148,100,59,132,13,109,106,62,122,106,90,168,228,14,207,11,147,9,255,157,10,0,174,39,125,7,158,177,240,15,147,68,135,8,163,210,30,1,242,104,105,6,194,254,247,98,87,93,128,101,103,203,25,108,54,113,110,107,6,231,254,212,27,118,137,211,43,224,16,218,122,90,103,221,74,204,249,185,223,111,142,190,239,249,23,183,190,67,96,176,142,213,214,214,163,232,161,209,147,126,56,216,194,196,79,223,242,82,209,187,103,241,166,188,87,103,63,181,6,221,72,178,54,75,216,13,43,218,175,10,27,76,54,3,74,246,65,4,122,96,223,96,239,195,168,103,223,85,49,110,142,239,70,105,190,121,203,97,179,140,188,102,131,26,37,111,210,160,82,104,226,54,204,12,119,149,187,11,71,3,34,2,22,185,85,5,38,47,197,186,59,190,178,189,11,40,43,180,90,146,92,179,106,4,194,215,255,167,181,208,207,49,44,217,158,139,91,222,174,29,155,100,194,176,236,99,242,38,117,106,163,156,2,109,147,10,156,9,6,169,235,14,54,63,114,7,103,133,5,0,87,19,149,191,74,130,226,184,122,20,123,177,43,174,12,182,27,56,146,210,142,155,229,213,190,13,124,220,239,183,11,219,223,33,134,211,210,212,241,212,226,66,104,221,179,248,31,218,131,110,129,190,22,205,246,185,38,91,111,176,119,225,24,183,71,119,136,8,90,230,255,15,106,112,102,6,59,202,17,1,11,92,143,101,158,255,248,98,174,105,97,107,255,211,22,108,207,69,160,10,226,120,215,13,210,238,78,4,131,84,57,3,179,194,167,103,38,97,208,96,22,247,73,105,71,77,62,110,119,219,174,209,106,74,217,214,90,220,64,223,11,102,55,216,59,240,169,188,174,83,222,187,158,197,71,178,207,127,48,181,255,233,189,189,242,28,202,186,194,138,83,179,147,48,36,180,163,166,186,208,54,5,205,215,6,147,84,222,87,41,35,217,103,191,179,102,122,46,196,97,74,184,93,104,27,2,42,111,43,148,180,11,190,55,195,12,142,161,90,5,223,27,45,2,239,141,0,0,0,0,25,27,49,65,50,54,98,130,43,45,83,195,100,108,197,4,125,119,244,69,86,90,167,134,79,65,150,199,200,217,138,8,209,194,187,73,250,239,232,138,227,244,217,203,172,181,79,12,181,174,126,77,158,131,45,142,135,152,28,207,74,194,18,81,83,217,35,16,120,244,112,211,97,239,65,146,46,174,215,85,55,181,230,20,28,152,181,215,5,131,132,150,130,27,152,89,155,0,169,24,176,45,250,219,169,54,203,154,230,119,93,93,255,108,108,28,212,65,63,223,205,90,14,158,149,132,36,162,140,159,21,227,167,178,70,32,190,169,119,97,241,232,225,166,232,243,208,231,195,222,131,36,218,197,178,101,93,93,174,170,68,70,159,235,111,107,204,40,118,112,253,105,57,49,107,174,32,42,90,239,11,7,9,44,18,28,56,109,223,70,54,243,198,93,7,178,237,112,84,113,244,107,101,48,187,42,243,247,162,49,194,182,137,28,145,117,144,7,160,52,23,159,188,251,14,132,141,186,37,169,222,121,60,178,239,56,115,243,121,255,106,232,72,190,65,197,27,125,88,222,42,60,240,121,79,5,233,98,126,68,194,79,45,135,219,84,28,198,148,21,138,1,141,14,187,64,166,35,232,131,191,56,217,194,56,160,197,13,33,187,244,76,10,150,167,143,19,141,150,206,92,204,0,9,69,215,49,72,110,250,98,139,119,225,83,202,186,187,93,84,163,160,108,21,136,141,63,214,145,150,14,151,222,215,152,80,199,204,169,17,236,225,250,210,245,250,203,147,114,98,215,92,107,121,230,29,64,84,181,222,89,79,132,159,22,14,18,88,15,21,35,25,36,56,112,218,61,35,65,155,101,253,107,167,124,230,90,230,87,203,9,37,78,208,56,100,1,145,174,163,24,138,159,226,51,167,204,33,42,188,253,96,173,36,225,175,180,63,208,238,159,18,131,45,134,9,178,108,201,72,36,171,208,83,21,234,251,126,70,41,226,101,119,104,47,63,121,246,54,36,72,183,29,9,27,116,4,18,42,53,75,83,188,242,82,72,141,179,121,101,222,112,96,126,239,49,231,230,243,254,254,253,194,191,213,208,145,124,204,203,160,61,131,138,54,250,154,145,7,187,177,188,84,120,168,167,101,57,59,131,152,75,34,152,169,10,9,181,250,201,16,174,203,136,95,239,93,79,70,244,108,14,109,217,63,205,116,194,14,140,243,90,18,67,234,65,35,2,193,108,112,193,216,119,65,128,151,54,215,71,142,45,230,6,165,0,181,197,188,27,132,132,113,65,138,26,104,90,187,91,67,119,232,152,90,108,217,217,21,45,79,30,12,54,126,95,39,27,45,156,62,0,28,221,185,152,0,18,160,131,49,83,139,174,98,144,146,181,83,209,221,244,197,22,196,239,244,87,239,194,167,148,246,217,150,213,174,7,188,233,183,28,141,168,156,49,222,107,133,42,239,42,202,107,121,237,211,112,72,172,248,93,27,111,225,70,42,46,102,222,54,225,127,197,7,160,84,232,84,99,77,243,101,34,2,178,243,229,27,169,194,164,48,132,145,103,41,159,160,38,228,197,174,184,253,222,159,249,214,243,204,58,207,232,253,123,128,169,107,188,153,178,90,253,178,159,9,62,171,132,56,127,44,28,36,176,53,7,21,241,30,42,70,50,7,49,119,115,72,112,225,180,81,107,208,245,122,70,131,54,99,93,178,119,203,250,215,78,210,225,230,15,249,204,181,204,224,215,132,141,175,150,18,74,182,141,35,11,157,160,112,200,132,187,65,137,3,35,93,70,26,56,108,7,49,21,63,196,40,14,14,133,103,79,152,66,126,84,169,3,85,121,250,192,76,98,203,129,129,56,197,31,152,35,244,94,179,14,167,157,170,21,150,220,229,84,0,27,252,79,49,90,215,98,98,153,206,121,83,216,73,225,79,23,80,250,126,86,123,215,45,149,98,204,28,212,45,141,138,19,52,150,187,82,31,187,232,145,6,160,217,208,94,126,243,236,71,101,194,173,108,72,145,110,117,83,160,47,58,18,54,232,35,9,7,169,8,36,84,106,17,63,101,43,150,167,121,228,143,188,72,165,164,145,27,102,189,138,42,39,242,203,188,224,235,208,141,161,192,253,222,98,217,230,239,35,20,188,225,189,13,167,208,252,38,138,131,63,63,145,178,126,112,208,36,185,105,203,21,248,66,230,70,59,91,253,119,122,220,101,107,181,197,126,90,244,238,83,9,55,247,72,56,118,184,9,174,177,161,18,159,240,138,63,204,51,147,36,253,114,0,0,0,0,1,194,106,55,3,132,212,110,2,70,190,89,7,9,168,220,6,203,194,235,4,141,124,178,5,79,22,133,14,19,81,184,15,209,59,143,13,151,133,214,12,85,239,225,9,26,249,100,8,216,147,83,10,158,45,10,11,92,71,61,28,38,163,112,29,228,201,71,31,162,119,30,30,96,29,41,27,47,11,172,26,237,97,155,24,171,223,194,25,105,181,245,18,53,242,200,19,247,152,255,17,177,38,166,16,115,76,145,21,60,90,20,20,254,48,35,22,184,142,122,23,122,228,77,56,77,70,224,57,143,44,215,59,201,146,142,58,11,248,185,63,68,238,60,62,134,132,11,60,192,58,82,61,2,80,101,54,94,23,88,55,156,125,111,53,218,195,54,52,24,169,1,49,87,191,132,48,149,213,179,50,211,107,234,51,17,1,221,36,107,229,144,37,169,143,167,39,239,49,254,38,45,91,201,35,98,77,76,34,160,39,123,32,230,153,34,33,36,243,21,42,120,180,40,43,186,222,31,41,252,96,70,40,62,10,113,45,113,28,244,44,179,118,195,46,245,200,154,47,55,162,173,112,154,141,192,113,88,231,247,115,30,89,174,114,220,51,153,119,147,37,28,118,81,79,43,116,23,241,114,117,213,155,69,126,137,220,120,127,75,182,79,125,13,8,22,124,207,98,33,121,128,116,164,120,66,30,147,122,4,160,202,123,198,202,253,108,188,46,176,109,126,68,135,111,56,250,222,110,250,144,233,107,181,134,108,106,119,236,91,104,49,82,2,105,243,56,53,98,175,127,8,99,109,21,63,97,43,171,102,96,233,193,81,101,166,215,212,100,100,189,227,102,34,3,186,103,224,105,141,72,215,203,32,73,21,161,23,75,83,31,78,74,145,117,121,79,222,99,252,78,28,9,203,76,90,183,146,77,152,221,165,70,196,154,152,71,6,240,175,69,64,78,246,68,130,36,193,65,205,50,68,64,15,88,115,66,73,230,42,67,139,140,29,84,241,104,80,85,51,2,103,87,117,188,62,86,183,214,9,83,248,192,140,82,58,170,187,80,124,20,226,81,190,126,213,90,226,57,232,91,32,83,223,89,102,237,134,88,164,135,177,93,235,145,52,92,41,251,3,94,111,69,90,95,173,47,109,225,53,27,128,224,247,113,183,226,177,207,238,227,115,165,217,230,60,179,92,231,254,217,107,229,184,103,50,228,122,13,5,239,38,74,56,238,228,32,15,236,162,158,86,237,96,244,97,232,47,226,228,233,237,136,211,235,171,54,138,234,105,92,189,253,19,184,240,252,209,210,199,254,151,108,158,255,85,6,169,250,26,16,44,251,216,122,27,249,158,196,66,248,92,174,117,243,0,233,72,242,194,131,127,240,132,61,38,241,70,87,17,244,9,65,148,245,203,43,163,247,141,149,250,246,79,255,205,217,120,93,96,216,186,55,87,218,252,137,14,219,62,227,57,222,113,245,188,223,179,159,139,221,245,33,210,220,55,75,229,215,107,12,216,214,169,102,239,212,239,216,182,213,45,178,129,208,98,164,4,209,160,206,51,211,230,112,106,210,36,26,93,197,94,254,16,196,156,148,39,198,218,42,126,199,24,64,73,194,87,86,204,195,149,60,251,193,211,130,162,192,17,232,149,203,77,175,168,202,143,197,159,200,201,123,198,201,11,17,241,204,68,7,116,205,134,109,67,207,192,211,26,206,2,185,45,145,175,150,64,144,109,252,119,146,43,66,46,147,233,40,25,150,166,62,156,151,100,84,171,149,34,234,242,148,224,128,197,159,188,199,248,158,126,173,207,156,56,19,150,157,250,121,161,152,181,111,36,153,119,5,19,155,49,187,74,154,243,209,125,141,137,53,48,140,75,95,7,142,13,225,94,143,207,139,105,138,128,157,236,139,66,247,219,137,4,73,130,136,198,35,181,131,154,100,136,130,88,14,191,128,30,176,230,129,220,218,209,132,147,204,84,133,81,166,99,135,23,24,58,134,213,114,13,169,226,208,160,168,32,186,151,170,102,4,206,171,164,110,249,174,235,120,124,175,41,18,75,173,111,172,18,172,173,198,37,167,241,129,24,166,51,235,47,164,117,85,118,165,183,63,65,160,248,41,196,161,58,67,243,163,124,253,170,162,190,151,157,181,196,115,208,180,6,25,231,182,64,167,190,183,130,205,137,178,205,219,12,179,15,177,59,177,73,15,98,176,139,101,85,187,215,34,104,186,21,72,95,184,83,246,6,185,145,156,49,188,222,138,180,189,28,224,131,191,90,94,218,190,152,52,237,0,0,0,0,184,188,103,101,170,9,200,139,18,181,175,238,143,98,151,87,55,222,240,50,37,107,95,220,157,215,56,185,197,180,40,239,125,8,79,138,111,189,224,100,215,1,135,1,74,214,191,184,242,106,216,221,224,223,119,51,88,99,16,86,80,25,87,159,232,165,48,250,250,16,159,20,66,172,248,113,223,123,192,200,103,199,167,173,117,114,8,67,205,206,111,38,149,173,127,112,45,17,24,21,63,164,183,251,135,24,208,158,26,207,232,39,162,115,143,66,176,198,32,172,8,122,71,201,160,50,175,62,24,142,200,91,10,59,103,181,178,135,0,208,47,80,56,105,151,236,95,12,133,89,240,226,61,229,151,135,101,134,135,209,221,58,224,180,207,143,79,90,119,51,40,63,234,228,16,134,82,88,119,227,64,237,216,13,248,81,191,104,240,43,248,161,72,151,159,196,90,34,48,42,226,158,87,79,127,73,111,246,199,245,8,147,213,64,167,125,109,252,192,24,53,159,208,78,141,35,183,43,159,150,24,197,39,42,127,160,186,253,71,25,2,65,32,124,16,244,143,146,168,72,232,247,155,20,88,61,35,168,63,88,49,29,144,182,137,161,247,211,20,118,207,106,172,202,168,15,190,127,7,225,6,195,96,132,94,160,112,210,230,28,23,183,244,169,184,89,76,21,223,60,209,194,231,133,105,126,128,224,123,203,47,14,195,119,72,107,203,13,15,162,115,177,104,199,97,4,199,41,217,184,160,76,68,111,152,245,252,211,255,144,238,102,80,126,86,218,55,27,14,185,39,77,182,5,64,40,164,176,239,198,28,12,136,163,129,219,176,26,57,103,215,127,43,210,120,145,147,110,31,244,59,38,247,3,131,154,144,102,145,47,63,136,41,147,88,237,180,68,96,84,12,248,7,49,30,77,168,223,166,241,207,186,254,146,223,236,70,46,184,137,84,155,23,103,236,39,112,2,113,240,72,187,201,76,47,222,219,249,128,48,99,69,231,85,107,63,160,156,211,131,199,249,193,54,104,23,121,138,15,114,228,93,55,203,92,225,80,174,78,84,255,64,246,232,152,37,174,139,136,115,22,55,239,22,4,130,64,248,188,62,39,157,33,233,31,36,153,85,120,65,139,224,215,175,51,92,176,202,237,89,182,59,85,229,209,94,71,80,126,176,255,236,25,213,98,59,33,108,218,135,70,9,200,50,233,231,112,142,142,130,40,237,158,212,144,81,249,177,130,228,86,95,58,88,49,58,167,143,9,131,31,51,110,230,13,134,193,8,181,58,166,109,189,64,225,164,5,252,134,193,23,73,41,47,175,245,78,74,50,34,118,243,138,158,17,150,152,43,190,120,32,151,217,29,120,244,201,75,192,72,174,46,210,253,1,192,106,65,102,165,247,150,94,28,79,42,57,121,93,159,150,151,229,35,241,242,77,107,25,5,245,215,126,96,231,98,209,142,95,222,182,235,194,9,142,82,122,181,233,55,104,0,70,217,208,188,33,188,136,223,49,234,48,99,86,143,34,214,249,97,154,106,158,4,7,189,166,189,191,1,193,216,173,180,110,54,21,8,9,83,29,114,78,154,165,206,41,255,183,123,134,17,15,199,225,116,146,16,217,205,42,172,190,168,56,25,17,70,128,165,118,35,216,198,102,117,96,122,1,16,114,207,174,254,202,115,201,155,87,164,241,34,239,24,150,71,253,173,57,169,69,17,94,204,118,77,238,6,206,241,137,99,220,68,38,141,100,248,65,232,249,47,121,81,65,147,30,52,83,38,177,218,235,154,214,191,179,249,198,233,11,69,161,140,25,240,14,98,161,76,105,7,60,155,81,190,132,39,54,219,150,146,153,53,46,46,254,80,38,84,185,153,158,232,222,252,140,93,113,18,52,225,22,119,169,54,46,206,17,138,73,171,3,63,230,69,187,131,129,32,227,224,145,118,91,92,246,19,73,233,89,253,241,85,62,152,108,130,6,33,212,62,97,68,198,139,206,170,126,55,169,207,214,127,65,56,110,195,38,93,124,118,137,179,196,202,238,214,89,29,214,111,225,161,177,10,243,20,30,228,75,168,121,129,19,203,105,215,171,119,14,178,185,194,161,92,1,126,198,57,156,169,254,128,36,21,153,229,54,160,54,11,142,28,81,110,134,102,22,167,62,218,113,194,44,111,222,44,148,211,185,73,9,4,129,240,177,184,230,149,163,13,73,123,27,177,46,30,67,210,62,72,251,110,89,45,233,219,246,195,81,103,145,166,204,176,169,31,116,12,206,122,102,185,97,148,222,5,6,241,68,38,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,169,72,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,70,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,2,0,0,0,177,72,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);
/* memory initializer */ allocate([180,39,0,0,1,0,0,0,46,68,0,0,0,0,0,0,112,1,0,0,1,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,4,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,152,1,0,0,1,0,0,0,5,0,0,0,3,0,0,0,4,0,0,0,4,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,0,0,0,0,168,1,0,0,6,0,0,0,7,0,0,0,2,0,0,0,0,0,0,0,184,1,0,0,8,0,0,0,9,0,0,0,3,0,0,0,0,0,0,0,232,1,0,0,1,0,0,0,10,0,0,0,3,0,0,0,4,0,0,0,5,0,0,0,0,0,0,0,216,1,0,0,1,0,0,0,11,0,0,0,3,0,0,0,4,0,0,0,6,0,0,0,0,0,0,0,104,2,0,0,1,0,0,0,12,0,0,0,3,0,0,0,4,0,0,0,4,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,0,0,5,0,16,0,5,0,8,0,5,0,24,0,5,0,4,0,5,0,20,0,5,0,12,0,5,0,28,0,5,0,2,0,5,0,18,0,5,0,10,0,5,0,26,0,5,0,6,0,5,0,22,0,5,0,14,0,5,0,30,0,5,0,1,0,5,0,17,0,5,0,9,0,5,0,25,0,5,0,5,0,5,0,21,0,5,0,13,0,5,0,29,0,5,0,3,0,5,0,19,0,5,0,11,0,5,0,27,0,5,0,7,0,5,0,23,0,5,0,12,0,8,0,140,0,8,0,76,0,8,0,204,0,8,0,44,0,8,0,172,0,8,0,108,0,8,0,236,0,8,0,28,0,8,0,156,0,8,0,92,0,8,0,220,0,8,0,60,0,8,0,188,0,8,0,124,0,8,0,252,0,8,0,2,0,8,0,130,0,8,0,66,0,8,0,194,0,8,0,34,0,8,0,162,0,8,0,98,0,8,0,226,0,8,0,18,0,8,0,146,0,8,0,82,0,8,0,210,0,8,0,50,0,8,0,178,0,8,0,114,0,8,0,242,0,8,0,10,0,8,0,138,0,8,0,74,0,8,0,202,0,8,0,42,0,8,0,170,0,8,0,106,0,8,0,234,0,8,0,26,0,8,0,154,0,8,0,90,0,8,0,218,0,8,0,58,0,8,0,186,0,8,0,122,0,8,0,250,0,8,0,6,0,8,0,134,0,8,0,70,0,8,0,198,0,8,0,38,0,8,0,166,0,8,0,102,0,8,0,230,0,8,0,22,0,8,0,150,0,8,0,86,0,8,0,214,0,8,0,54,0,8,0,182,0,8,0,118,0,8,0,246,0,8,0,14,0,8,0,142,0,8,0,78,0,8,0,206,0,8,0,46,0,8,0,174,0,8,0,110,0,8,0,238,0,8,0,30,0,8,0,158,0,8,0,94,0,8,0,222,0,8,0,62,0,8,0,190,0,8,0,126,0,8,0,254,0,8,0,1,0,8,0,129,0,8,0,65,0,8,0,193,0,8,0,33,0,8,0,161,0,8,0,97,0,8,0,225,0,8,0,17,0,8,0,145,0,8,0,81,0,8,0,209,0,8,0,49,0,8,0,177,0,8,0,113,0,8,0,241,0,8,0,9,0,8,0,137,0,8,0,73,0,8,0,201,0,8,0,41,0,8,0,169,0,8,0,105,0,8,0,233,0,8,0,25,0,8,0,153,0,8,0,89,0,8,0,217,0,8,0,57,0,8,0,185,0,8,0,121,0,8,0,249,0,8,0,5,0,8,0,133,0,8,0,69,0,8,0,197,0,8,0,37,0,8,0,165,0,8,0,101,0,8,0,229,0,8,0,21,0,8,0,149,0,8,0,85,0,8,0,213,0,8,0,53,0,8,0,181,0,8,0,117,0,8,0,245,0,8,0,13,0,8,0,141,0,8,0,77,0,8,0,205,0,8,0,45,0,8,0,173,0,8,0,109,0,8,0,237,0,8,0,29,0,8,0,157,0,8,0,93,0,8,0,221,0,8,0,61,0,8,0,189,0,8,0,125,0,8,0,253,0,8,0,19,0,9,0,19,1,9,0,147,0,9,0,147,1,9,0,83,0,9,0,83,1,9,0,211,0,9,0,211,1,9,0,51,0,9,0,51,1,9,0,179,0,9,0,179,1,9,0,115,0,9,0,115,1,9,0,243,0,9,0,243,1,9,0,11,0,9,0,11,1,9,0,139,0,9,0,139,1,9,0,75,0,9,0,75,1,9,0,203,0,9,0,203,1,9,0,43,0,9,0,43,1,9,0,171,0,9,0,171,1,9,0,107,0,9,0,107,1,9,0,235,0,9,0,235,1,9,0,27,0,9,0,27,1,9,0,155,0,9,0,155,1,9,0,91,0,9,0,91,1,9,0,219,0,9,0,219,1,9,0,59,0,9,0,59,1,9,0,187,0,9,0,187,1,9,0,123,0,9,0,123,1,9,0,251,0,9,0,251,1,9,0,7,0,9,0,7,1,9,0,135,0,9,0,135,1,9,0,71,0,9,0,71,1,9,0,199,0,9,0,199,1,9,0,39,0,9,0,39,1,9,0,167,0,9,0,167,1,9,0,103,0,9,0,103,1,9,0,231,0,9,0,231,1,9,0,23,0,9,0,23,1,9,0,151,0,9,0,151,1,9,0,87,0,9,0,87,1,9,0,215,0,9,0,215,1,9,0,55,0,9,0,55,1,9,0,183,0,9,0,183,1,9,0,119,0,9,0,119,1,9,0,247,0,9,0,247,1,9,0,15,0,9,0,15,1,9,0,143,0,9,0,143,1,9,0,79,0,9,0,79,1,9,0,207,0,9,0,207,1,9,0,47,0,9,0,47,1,9,0,175,0,9,0,175,1,9,0,111,0,9,0,111,1,9,0,239,0,9,0,239,1,9,0,31,0,9,0,31,1,9,0,159,0,9,0,159,1,9,0,95,0,9,0,95,1,9,0,223,0,9,0,223,1,9,0,63,0,9,0,63,1,9,0,191,0,9,0,191,1,9,0,127,0,9,0,127,1,9,0,255,0,9,0,255,1,9,0,0,0,7,0,64,0,7,0,32,0,7,0,96,0,7,0,16,0,7,0,80,0,7,0,48,0,7,0,112,0,7,0,8,0,7,0,72,0,7,0,40,0,7,0,104,0,7,0,24,0,7,0,88,0,7,0,56,0,7,0,120,0,7,0,4,0,7,0,68,0,7,0,36,0,7,0,100,0,7,0,20,0,7,0,84,0,7,0,52,0,7,0,116,0,7,0,3,0,8,0,131,0,8,0,67,0,8,0,195,0,8,0,35,0,8,0,163,0,8,0,99,0,8,0,227,0,8,0,86,101,99,116,111,114,83,104,111,114,116,0,86,101,99,116,111,114,85,67,104,97,114,0,105,105,0,118,0,118,105,0,112,117,115,104,95,98,97,99,107,0,118,105,105,105,0,114,101,115,105,122,101,0,118,105,105,105,105,0,115,105,122,101,0,105,105,105,0,103,101,116,0,105,105,105,105,0,115,101,116,0,105,105,105,105,105,0,78,49,48,101,109,115,99,114,105,112,116,101,110,51,118,97,108,69,0,80,75,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,104,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,80,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,104,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,104,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,78,83,116,51,95,95,50,49,51,95,95,118,101,99,116,111,114,95,98,97,115,101,73,104,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,78,83,116,51,95,95,50,50,48,95,95,118,101,99,116,111,114,95,98,97,115,101,95,99,111,109,109,111,110,73,76,98,49,69,69,69,0,80,75,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,115,78,83,95,57,97,108,108,111,99,97,116,111,114,73,115,69,69,69,69,0,80,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,115,78,83,95,57,97,108,108,111,99,97,116,111,114,73,115,69,69,69,69,0,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,115,78,83,95,57,97,108,108,111,99,97,116,111,114,73,115,69,69,69,69,0,78,83,116,51,95,95,50,49,51,95,95,118,101,99,116,111,114,95,98,97,115,101,73,115,78,83,95,57,97,108,108,111,99,97,116,111,114,73,115,69,69,69,69,0,99,111,109,112,114,101,115,115,0,101,110,99,111,100,101,73,109,97,103,101,0,100,101,99,111,100,101,73,109,97,103,101,0,104,97,97,114,84,114,97,110,115,102,111,114,109,0,105,104,97,97,114,84,114,97,110,115,102,111,114,109,0,104,97,97,114,84,114,97,110,115,102,111,114,109,50,68,0,105,104,97,97,114,84,114,97,110,115,102,111,114,109,50,68,0,116,104,114,101,115,104,111,108,100,0,116,104,114,101,115,104,111,108,100,50,0,116,104,114,101,115,104,111,108,100,51,0,118,97,108,117,101,32,111,117,116,32,111,102,32,114,97,110,103,101,32,102,111,114,32,115,116,97,114,116,44,32,115,116,111,112,44,32,115,116,101,112,32,101,110,99,111,100,101,114,32,40,110,101,103,97,116,105,118,101,41,0,118,97,108,117,101,32,111,117,116,32,111,102,32,114,97,110,103,101,32,102,111,114,32,115,116,97,114,116,44,32,115,116,101,112,44,32,115,116,111,112,32,101,110,99,111,100,101,114,32,40,111,118,101,114,32,116,104,101,32,109,97,120,41,0,49,46,50,46,49,49,0,0,1,2,3,4,4,5,5,6,6,6,6,7,7,7,7,8,8,8,8,8,8,8,8,9,9,9,9,9,9,9,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,13,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,15,0,0,16,17,18,18,19,19,20,20,20,20,21,21,21,21,22,22,22,22,22,22,22,22,23,23,23,23,23,23,23,23,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,29,0,1,2,3,4,5,6,7,8,8,9,9,10,10,11,11,12,12,12,12,13,13,13,13,14,14,14,14,15,15,15,15,16,16,16,16,16,16,16,16,17,17,17,17,17,17,17,17,18,18,18,18,18,18,18,18,19,19,19,19,19,19,19,19,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,23,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,25,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,27,28,16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15,110,101,101,100,32,100,105,99,116,105,111,110,97,114,121,0,115,116,114,101,97,109,32,101,110,100,0,102,105,108,101,32,101,114,114,111,114,0,115,116,114,101,97,109,32,101,114,114,111,114,0,100,97,116,97,32,101,114,114,111,114,0,105,110,115,117,102,102,105,99,105,101,110,116,32,109,101,109,111,114,121,0,98,117,102,102,101,114,32,101,114,114,111,114,0,105,110,99,111,109,112,97,116,105,98,108,101,32,118,101,114,115,105,111,110,0,118,111,105,100,0,98,111,111,108,0,99,104,97,114,0,115,105,103,110,101,100,32,99,104,97,114,0,117,110,115,105,103,110,101,100,32,99,104,97,114,0,115,104,111,114,116,0,117,110,115,105,103,110,101,100,32,115,104,111,114,116,0,105,110,116,0,117,110,115,105,103,110,101,100,32,105,110,116,0,108,111,110,103,0,117,110,115,105,103,110,101,100,32,108,111,110,103,0,102,108,111,97,116,0,100,111,117,98,108,101,0,115,116,100,58,58,115,116,114,105,110,103,0,115,116,100,58,58,98,97,115,105,99,95,115,116,114,105,110,103,60,117,110,115,105,103,110,101,100,32,99,104,97,114,62,0,115,116,100,58,58,119,115,116,114,105,110,103,0,101,109,115,99,114,105,112,116,101,110,58,58,118,97,108,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,115,105,103,110,101,100,32,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,115,104,111,114,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,115,104,111,114,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,105,110,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,108,111,110,103,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,108,111,110,103,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,56,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,56,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,49,54,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,49,54,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,51,50,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,51,50,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,102,108,111,97,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,100,111,117,98,108,101,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,108,111,110,103,32,100,111,117,98,108,101,62,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,101,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,100,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,102,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,109,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,108,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,106,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,105,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,116,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,115,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,104,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,97,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,99,69,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,119,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,119,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,119,69,69,69,69,0,78,83,116,51,95,95,50,50,49,95,95,98,97,115,105,99,95,115,116,114,105,110,103,95,99,111,109,109,111,110,73,76,98,49,69,69,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,104,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,104,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,99,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,99,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,99,69,69,69,69,0,17,0,10,0,17,17,17,0,0,0,0,5,0,0,0,0,0,0,9,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,15,10,17,17,17,3,10,7,0,1,19,9,11,11,0,0,9,6,11,0,0,11,0,6,17,0,0,0,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,10,10,17,17,17,0,10,0,0,2,0,9,11,0,0,0,9,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,13,0,0,0,0,9,14,0,0,0,0,0,14,0,0,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,15,0,0,0,0,9,16,0,0,0,0,0,16,0,0,16,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,10,0,0,0,0,9,11,0,0,0,0,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,48,49,50,51,52,53,54,55,56,57,65,66,67,68,69,70,45,43,32,32,32,48,88,48,120,0,40,110,117,108,108,41,0,45,48,88,43,48,88,32,48,88,45,48,120,43,48,120,32,48,120,0,105,110,102,0,73,78,70,0,110,97,110,0,78,65,78,0,46,0,84,33,34,25,13,1,2,3,17,75,28,12,16,4,11,29,18,30,39,104,110,111,112,113,98,32,5,6,15,19,20,21,26,8,22,7,40,36,23,24,9,10,14,27,31,37,35,131,130,125,38,42,43,60,61,62,63,67,71,74,77,88,89,90,91,92,93,94,95,96,97,99,100,101,102,103,105,106,107,108,114,115,116,121,122,123,124,0,73,108,108,101,103,97,108,32,98,121,116,101,32,115,101,113,117,101,110,99,101,0,68,111,109,97,105,110,32,101,114,114,111,114,0,82,101,115,117,108,116,32,110,111,116,32,114,101,112,114,101,115,101,110,116,97,98,108,101,0,78,111,116,32,97,32,116,116,121,0,80,101,114,109,105,115,115,105,111,110,32,100,101,110,105,101,100,0,79,112,101,114,97,116,105,111,110,32,110,111,116,32,112,101,114,109,105,116,116,101,100,0,78,111,32,115,117,99,104,32,102,105,108,101,32,111,114,32,100,105,114,101,99,116,111,114,121,0,78,111,32,115,117,99,104,32,112,114,111,99,101,115,115,0,70,105,108,101,32,101,120,105,115,116,115,0,86,97,108,117,101,32,116,111,111,32,108,97,114,103,101,32,102,111,114,32,100,97,116,97,32,116,121,112,101,0,78,111,32,115,112,97,99,101,32,108,101,102,116,32,111,110,32,100,101,118,105,99,101,0,79,117,116,32,111,102,32,109,101,109,111,114,121,0,82,101,115,111,117,114,99,101,32,98,117,115,121,0,73,110,116,101,114,114,117,112,116,101,100,32,115,121,115,116,101,109,32,99,97,108,108,0,82,101,115,111,117,114,99,101,32,116,101,109,112,111,114,97,114,105,108,121,32,117,110,97,118,97,105,108,97,98,108,101,0,73,110,118,97,108,105,100,32,115,101,101,107,0,67,114,111,115,115,45,100,101,118,105,99,101,32,108,105,110,107,0,82,101,97,100,45,111,110,108,121,32,102,105,108,101,32,115,121,115,116,101,109,0,68,105,114,101,99,116,111,114,121,32,110,111,116,32,101,109,112,116,121,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,112,101,101,114,0,79,112,101,114,97,116,105,111,110,32,116,105,109,101,100,32,111,117,116,0,67,111,110,110,101,99,116,105,111,110,32,114,101,102,117,115,101,100,0,72,111,115,116,32,105,115,32,100,111,119,110,0,72,111,115,116,32,105,115,32,117,110,114,101,97,99,104,97,98,108,101,0,65,100,100,114,101,115,115,32,105,110,32,117,115,101,0,66,114,111,107,101,110,32,112,105,112,101,0,73,47,79,32,101,114,114,111,114,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,32,111,114,32,97,100,100,114,101,115,115,0,66,108,111,99,107,32,100,101,118,105,99,101,32,114,101,113,117,105,114,101,100,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,0,78,111,116,32,97,32,100,105,114,101,99,116,111,114,121,0,73,115,32,97,32,100,105,114,101,99,116,111,114,121,0,84,101,120,116,32,102,105,108,101,32,98,117,115,121,0,69,120,101,99,32,102,111,114,109,97,116,32,101,114,114,111,114,0,73,110,118,97,108,105,100,32,97,114,103,117,109,101,110,116,0,65,114,103,117,109,101,110,116,32,108,105,115,116,32,116,111,111,32,108,111,110,103,0,83,121,109,98,111,108,105,99,32,108,105,110,107,32,108,111,111,112,0,70,105,108,101,110,97,109,101,32,116,111,111,32,108,111,110,103,0,84,111,111,32,109,97,110,121,32,111,112,101,110,32,102,105,108,101,115,32,105,110,32,115,121,115,116,101,109,0,78,111,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,115,32,97,118,97,105,108,97,98,108,101,0,66,97,100,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,0,78,111,32,99,104,105,108,100,32,112,114,111,99,101,115,115,0,66,97,100,32,97,100,100,114,101,115,115,0,70,105,108,101,32,116,111,111,32,108,97,114,103,101,0,84,111,111,32,109,97,110,121,32,108,105,110,107,115,0,78,111,32,108,111,99,107,115,32,97,118,97,105,108,97,98,108,101,0,82,101,115,111,117,114,99,101,32,100,101,97,100,108,111,99,107,32,119,111,117,108,100,32,111,99,99,117,114,0,83,116,97,116,101,32,110,111,116,32,114,101,99,111,118,101,114,97,98,108,101,0,80,114,101,118,105,111,117,115,32,111,119,110,101,114,32,100,105,101,100,0,79,112,101,114,97,116,105,111,110,32,99,97,110,99,101,108,101,100,0,70,117,110,99,116,105,111,110,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,0,78,111,32,109,101,115,115,97,103,101,32,111,102,32,100,101,115,105,114,101,100,32,116,121,112,101,0,73,100,101,110,116,105,102,105,101,114,32,114,101,109,111,118,101,100,0,68,101,118,105,99,101,32,110,111,116,32,97,32,115,116,114,101,97,109,0,78,111,32,100,97,116,97,32,97,118,97,105,108,97,98,108,101,0,68,101,118,105,99,101,32,116,105,109,101,111,117,116,0,79,117,116,32,111,102,32,115,116,114,101,97,109,115,32,114,101,115,111,117,114,99,101,115,0,76,105,110,107,32,104,97,115,32,98,101,101,110,32,115,101,118,101,114,101,100,0,80,114,111,116,111,99,111,108,32,101,114,114,111,114,0,66,97,100,32,109,101,115,115,97,103,101,0,70,105,108,101,32,100,101,115,99,114,105,112,116,111,114,32,105,110,32,98,97,100,32,115,116,97,116,101,0,78,111,116,32,97,32,115,111,99,107,101,116,0,68,101,115,116,105,110,97,116,105,111,110,32,97,100,100,114,101,115,115,32,114,101,113,117,105,114,101,100,0,77,101,115,115,97,103,101,32,116,111,111,32,108,97,114,103,101,0,80,114,111,116,111,99,111,108,32,119,114,111,110,103,32,116,121,112,101,32,102,111,114,32,115,111,99,107,101,116,0,80,114,111,116,111,99,111,108,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,80,114,111,116,111,99,111,108,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,83,111,99,107,101,116,32,116,121,112,101,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,78,111,116,32,115,117,112,112,111,114,116,101,100,0,80,114,111,116,111,99,111,108,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,65,100,100,114,101,115,115,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,32,98,121,32,112,114,111,116,111,99,111,108,0,65,100,100,114,101,115,115,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,78,101,116,119,111,114,107,32,105,115,32,100,111,119,110,0,78,101,116,119,111,114,107,32,117,110,114,101,97,99,104,97,98,108,101,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,110,101,116,119,111,114,107,0,67,111,110,110,101,99,116,105,111,110,32,97,98,111,114,116,101,100,0,78,111,32,98,117,102,102,101,114,32,115,112,97,99,101,32,97,118,97,105,108,97,98,108,101,0,83,111,99,107,101,116,32,105,115,32,99,111,110,110,101,99,116,101,100,0,83,111,99,107,101,116,32,110,111,116,32,99,111,110,110,101,99,116,101,100,0,67,97,110,110,111,116,32,115,101,110,100,32,97,102,116,101,114,32,115,111,99,107,101,116,32,115,104,117,116,100,111,119,110,0,79,112,101,114,97,116,105,111,110,32,97,108,114,101,97,100,121,32,105,110,32,112,114,111,103,114,101,115,115,0,79,112,101,114,97,116,105,111,110,32,105,110,32,112,114,111,103,114,101,115,115,0,83,116,97,108,101,32,102,105,108,101,32,104,97,110,100,108,101,0,82,101,109,111,116,101,32,73,47,79,32,101,114,114,111,114,0,81,117,111,116,97,32,101,120,99,101,101,100,101,100,0,78,111,32,109,101,100,105,117,109,32,102,111,117,110,100,0,87,114,111,110,103,32,109,101,100,105,117,109,32,116,121,112,101,0,78,111,32,101,114,114,111,114,32,105,110,102,111,114,109,97,116,105,111,110,0,0,33,34,118,101,99,116,111,114,32,108,101,110,103,116,104,95,101,114,114,111,114,34,0,47,117,115,114,47,108,105,98,47,101,109,115,99,114,105,112,116,101,110,47,115,121,115,116,101,109,47,105,110,99,108,117,100,101,47,108,105,98,99,120,120,47,118,101,99,116,111,114,0,95,95,116,104,114,111,119,95,108,101,110,103,116,104,95,101,114,114,111,114,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,101,120,99,101,112,116,105,111,110,32,111,102,32,116,121,112,101,32,37,115,58,32,37,115,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,101,120,99,101,112,116,105,111,110,32,111,102,32,116,121,112,101,32,37,115,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,102,111,114,101,105,103,110,32,101,120,99,101,112,116,105,111,110,0,116,101,114,109,105,110,97,116,105,110,103,0,117,110,99,97,117,103,104,116,0,83,116,57,101,120,99,101,112,116,105,111,110,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,54,95,95,115,104,105,109,95,116,121,112,101,95,105,110,102,111,69,0,83,116,57,116,121,112,101,95,105,110,102,111,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,48,95,95,115,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,112,116,104,114,101,97,100,95,111,110,99,101,32,102,97,105,108,117,114,101,32,105,110,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,95,102,97,115,116,40,41,0,99,97,110,110,111,116,32,99,114,101,97,116,101,32,112,116,104,114,101,97,100,32,107,101,121,32,102,111,114,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,40,41,0,99,97,110,110,111,116,32,122,101,114,111,32,111,117,116,32,116,104,114,101,97,100,32,118,97,108,117,101,32,102,111,114,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,40,41,0,116,101,114,109,105,110,97,116,101,95,104,97,110,100,108,101,114,32,117,110,101,120,112,101,99,116,101,100,108,121,32,114,101,116,117,114,110,101,100,0,115,116,100,58,58,98,97,100,95,97,108,108,111,99,0,83,116,57,98,97,100,95,97,108,108,111,99,0,83,116,49,51,114,117,110,116,105,109,101,95,101,114,114,111,114,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,57,95,95,112,111,105,110,116,101,114,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,112,98,97,115,101,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,51,95,95,102,117,110,100,97,109,101,110,116,97,108,95,116,121,112,101,95,105,110,102,111,69,0,118,0,68,110,0,98,0,99,0,104,0,97,0,115,0,116,0,105,0,106,0,108,0,109,0,102,0,100,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,49,95,95,118,109,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+10280);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


   
  Module["_i64Subtract"] = _i64Subtract;

  function ___assert_fail(condition, filename, line, func) {
      ABORT = true;
      throw 'Assertion failed: ' + Pointer_stringify(condition) + ', at: ' + [filename ? Pointer_stringify(filename) : 'unknown filename', line, func ? Pointer_stringify(func) : 'unknown function'] + ' at ' + stackTrace();
    }

  
  
  
  function embind_init_charCodes() {
      var codes = new Array(256);
      for (var i = 0; i < 256; ++i) {
          codes[i] = String.fromCharCode(i);
      }
      embind_charCodes = codes;
    }var embind_charCodes=undefined;function readLatin1String(ptr) {
      var ret = "";
      var c = ptr;
      while (HEAPU8[c]) {
          ret += embind_charCodes[HEAPU8[c++]];
      }
      return ret;
    }
  
  
  var awaitingDependencies={};
  
  var registeredTypes={};
  
  var typeDependencies={};
  
  
  
  
  
  
  var char_0=48;
  
  var char_9=57;function makeLegalFunctionName(name) {
      if (undefined === name) {
          return '_unknown';
      }
      name = name.replace(/[^a-zA-Z0-9_]/g, '$');
      var f = name.charCodeAt(0);
      if (f >= char_0 && f <= char_9) {
          return '_' + name;
      } else {
          return name;
      }
    }function createNamedFunction(name, body) {
      name = makeLegalFunctionName(name);
      /*jshint evil:true*/
      return new Function(
          "body",
          "return function " + name + "() {\n" +
          "    \"use strict\";" +
          "    return body.apply(this, arguments);\n" +
          "};\n"
      )(body);
    }function extendError(baseErrorType, errorName) {
      var errorClass = createNamedFunction(errorName, function(message) {
          this.name = errorName;
          this.message = message;
  
          var stack = (new Error(message)).stack;
          if (stack !== undefined) {
              this.stack = this.toString() + '\n' +
                  stack.replace(/^Error(:[^\n]*)?\n/, '');
          }
      });
      errorClass.prototype = Object.create(baseErrorType.prototype);
      errorClass.prototype.constructor = errorClass;
      errorClass.prototype.toString = function() {
          if (this.message === undefined) {
              return this.name;
          } else {
              return this.name + ': ' + this.message;
          }
      };
  
      return errorClass;
    }var BindingError=undefined;function throwBindingError(message) {
      throw new BindingError(message);
    }
  
  
  
  var InternalError=undefined;function throwInternalError(message) {
      throw new InternalError(message);
    }function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
      myTypes.forEach(function(type) {
          typeDependencies[type] = dependentTypes;
      });
  
      function onComplete(typeConverters) {
          var myTypeConverters = getTypeConverters(typeConverters);
          if (myTypeConverters.length !== myTypes.length) {
              throwInternalError('Mismatched type converter count');
          }
          for (var i = 0; i < myTypes.length; ++i) {
              registerType(myTypes[i], myTypeConverters[i]);
          }
      }
  
      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach(function(dt, i) {
          if (registeredTypes.hasOwnProperty(dt)) {
              typeConverters[i] = registeredTypes[dt];
          } else {
              unregisteredTypes.push(dt);
              if (!awaitingDependencies.hasOwnProperty(dt)) {
                  awaitingDependencies[dt] = [];
              }
              awaitingDependencies[dt].push(function() {
                  typeConverters[i] = registeredTypes[dt];
                  ++registered;
                  if (registered === unregisteredTypes.length) {
                      onComplete(typeConverters);
                  }
              });
          }
      });
      if (0 === unregisteredTypes.length) {
          onComplete(typeConverters);
      }
    }function registerType(rawType, registeredInstance, options) {
      options = options || {};
  
      if (!('argPackAdvance' in registeredInstance)) {
          throw new TypeError('registerType registeredInstance requires argPackAdvance');
      }
  
      var name = registeredInstance.name;
      if (!rawType) {
          throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
      }
      if (registeredTypes.hasOwnProperty(rawType)) {
          if (options.ignoreDuplicateRegistrations) {
              return;
          } else {
              throwBindingError("Cannot register type '" + name + "' twice");
          }
      }
  
      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];
  
      if (awaitingDependencies.hasOwnProperty(rawType)) {
          var callbacks = awaitingDependencies[rawType];
          delete awaitingDependencies[rawType];
          callbacks.forEach(function(cb) {
              cb();
          });
      }
    }function __embind_register_void(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          isVoid: true, // void return values can be optimized out sometimes
          name: name,
          'argPackAdvance': 0,
          'fromWireType': function() {
              return undefined;
          },
          'toWireType': function(destructors, o) {
              // TODO: assert if anything else is given?
              return undefined;
          },
      });
    }

  
  function __ZSt18uncaught_exceptionv() { // std::uncaught_exception()
      return !!__ZSt18uncaught_exceptionv.uncaught_exception;
    }
  
  
  
  var EXCEPTIONS={last:0,caught:[],infos:{},deAdjust:function (adjusted) {
        if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
        for (var ptr in EXCEPTIONS.infos) {
          var info = EXCEPTIONS.infos[ptr];
          if (info.adjusted === adjusted) {
            return ptr;
          }
        }
        return adjusted;
      },addRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount++;
      },decRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        assert(info.refcount > 0);
        info.refcount--;
        // A rethrown exception can reach refcount 0; it must not be discarded
        // Its next handler will clear the rethrown flag and addRef it, prior to
        // final decRef and destruction here
        if (info.refcount === 0 && !info.rethrown) {
          if (info.destructor) {
            Module['dynCall_vi'](info.destructor, ptr);
          }
          delete EXCEPTIONS.infos[ptr];
          ___cxa_free_exception(ptr);
        }
      },clearRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount = 0;
      }};
  function ___resumeException(ptr) {
      if (!EXCEPTIONS.last) { EXCEPTIONS.last = ptr; }
      throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
    }function ___cxa_find_matching_catch() {
      var thrown = EXCEPTIONS.last;
      if (!thrown) {
        // just pass through the null ptr
        return ((Runtime.setTempRet0(0),0)|0);
      }
      var info = EXCEPTIONS.infos[thrown];
      var throwntype = info.type;
      if (!throwntype) {
        // just pass through the thrown ptr
        return ((Runtime.setTempRet0(0),thrown)|0);
      }
      var typeArray = Array.prototype.slice.call(arguments);
  
      var pointer = Module['___cxa_is_pointer_type'](throwntype);
      // can_catch receives a **, add indirection
      if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
      HEAP32[((___cxa_find_matching_catch.buffer)>>2)]=thrown;
      thrown = ___cxa_find_matching_catch.buffer;
      // The different catch blocks are denoted by different types.
      // Due to inheritance, those types may not precisely match the
      // type of the thrown object. Find one which matches, and
      // return the type of the catch block which should be called.
      for (var i = 0; i < typeArray.length; i++) {
        if (typeArray[i] && Module['___cxa_can_catch'](typeArray[i], throwntype, thrown)) {
          thrown = HEAP32[((thrown)>>2)]; // undo indirection
          info.adjusted = thrown;
          return ((Runtime.setTempRet0(typeArray[i]),thrown)|0);
        }
      }
      // Shouldn't happen unless we have bogus data in typeArray
      // or encounter a type for which emscripten doesn't have suitable
      // typeinfo defined. Best-efforts match just in case.
      thrown = HEAP32[((thrown)>>2)]; // undo indirection
      return ((Runtime.setTempRet0(throwntype),thrown)|0);
    }function ___cxa_throw(ptr, type, destructor) {
      EXCEPTIONS.infos[ptr] = {
        ptr: ptr,
        adjusted: ptr,
        type: type,
        destructor: destructor,
        refcount: 0,
        caught: false,
        rethrown: false
      };
      EXCEPTIONS.last = ptr;
      if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exception = 1;
      } else {
        __ZSt18uncaught_exceptionv.uncaught_exception++;
      }
      throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
    }

   
  Module["_memset"] = _memset;

  
  function getShiftFromSize(size) {
      switch (size) {
          case 1: return 0;
          case 2: return 1;
          case 4: return 2;
          case 8: return 3;
          default:
              throw new TypeError('Unknown type size: ' + size);
      }
    }function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
      var shift = getShiftFromSize(size);
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(wt) {
              // ambiguous emscripten ABI: sometimes return values are
              // true or false, and sometimes integers (0 or 1)
              return !!wt;
          },
          'toWireType': function(destructors, o) {
              return o ? trueValue : falseValue;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': function(pointer) {
              // TODO: if heap is fixed (like in asm.js) this could be executed outside
              var heap;
              if (size === 1) {
                  heap = HEAP8;
              } else if (size === 2) {
                  heap = HEAP16;
              } else if (size === 4) {
                  heap = HEAP32;
              } else {
                  throw new TypeError("Unknown boolean type size: " + name);
              }
              return this['fromWireType'](heap[pointer >> shift]);
          },
          destructorFunction: null, // This type does not need a destructor
      });
    }

   
  Module["_bitshift64Shl"] = _bitshift64Shl;

  function _abort() {
      Module['abort']();
    }

  
  function _free() {
  }
  Module["_free"] = _free;
  
  function _malloc(bytes) {
      /* Over-allocate to make sure it is byte-aligned by 8.
       * This will leak memory, but this is only the dummy
       * implementation (replaced by dlmalloc normally) so
       * not an issue.
       */
      var ptr = Runtime.dynamicAlloc(bytes + 8);
      return (ptr+8) & 0xFFFFFFF8;
    }
  Module["_malloc"] = _malloc;
  
  function simpleReadValueFromPointer(pointer) {
      return this['fromWireType'](HEAPU32[pointer >> 2]);
    }function __embind_register_std_string(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              if (value instanceof ArrayBuffer) {
                  value = new Uint8Array(value);
              }
  
              function getTAElement(ta, index) {
                  return ta[index];
              }
              function getStringElement(string, index) {
                  return string.charCodeAt(index);
              }
              var getElement;
              if (value instanceof Uint8Array) {
                  getElement = getTAElement;
              } else if (value instanceof Uint8ClampedArray) {
                  getElement = getTAElement;
              } else if (value instanceof Int8Array) {
                  getElement = getTAElement;
              } else if (typeof value === 'string') {
                  getElement = getStringElement;
              } else {
                  throwBindingError('Cannot pass non-string to std::string');
              }
  
              // assumes 4-byte alignment
              var length = value.length;
              var ptr = _malloc(4 + length);
              HEAPU32[ptr >> 2] = length;
              for (var i = 0; i < length; ++i) {
                  var charCode = getElement(value, i);
                  if (charCode > 255) {
                      _free(ptr);
                      throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                  }
                  HEAPU8[ptr + 4 + i] = charCode;
              }
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  
  function _embind_repr(v) {
      if (v === null) {
          return 'null';
      }
      var t = typeof v;
      if (t === 'object' || t === 'array' || t === 'function') {
          return v.toString();
      } else {
          return '' + v;
      }
    }
  
  function integerReadValueFromPointer(name, shift, signed) {
      // integers are quite common, so generate very specialized functions
      switch (shift) {
          case 0: return signed ?
              function readS8FromPointer(pointer) { return HEAP8[pointer]; } :
              function readU8FromPointer(pointer) { return HEAPU8[pointer]; };
          case 1: return signed ?
              function readS16FromPointer(pointer) { return HEAP16[pointer >> 1]; } :
              function readU16FromPointer(pointer) { return HEAPU16[pointer >> 1]; };
          case 2: return signed ?
              function readS32FromPointer(pointer) { return HEAP32[pointer >> 2]; } :
              function readU32FromPointer(pointer) { return HEAPU32[pointer >> 2]; };
          default:
              throw new TypeError("Unknown integer type: " + name);
      }
    }function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
      name = readLatin1String(name);
      if (maxRange === -1) { // LLVM doesn't have signed and unsigned 32-bit types, so u32 literals come out as 'i32 -1'. Always treat those as max u32.
          maxRange = 4294967295;
      }
  
      var shift = getShiftFromSize(size);
      
      var fromWireType = function(value) {
          return value;
      };
      
      if (minRange === 0) {
          var bitshift = 32 - 8*size;
          fromWireType = function(value) {
              return (value << bitshift) >>> bitshift;
          };
      }
  
      registerType(primitiveType, {
          name: name,
          'fromWireType': fromWireType,
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following two if()s and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              if (value < minRange || value > maxRange) {
                  throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ', ' + maxRange + ']!');
              }
              return value | 0;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': integerReadValueFromPointer(name, shift, minRange !== 0),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  function _pthread_once(ptr, func) {
      if (!_pthread_once.seen) _pthread_once.seen = {};
      if (ptr in _pthread_once.seen) return;
      Module['dynCall_v'](func);
      _pthread_once.seen[ptr] = 1;
    }

  
  
  
  function ClassHandle_isAliasOf(other) {
      if (!(this instanceof ClassHandle)) {
          return false;
      }
      if (!(other instanceof ClassHandle)) {
          return false;
      }
  
      var leftClass = this.$$.ptrType.registeredClass;
      var left = this.$$.ptr;
      var rightClass = other.$$.ptrType.registeredClass;
      var right = other.$$.ptr;
  
      while (leftClass.baseClass) {
          left = leftClass.upcast(left);
          leftClass = leftClass.baseClass;
      }
  
      while (rightClass.baseClass) {
          right = rightClass.upcast(right);
          rightClass = rightClass.baseClass;
      }
  
      return leftClass === rightClass && left === right;
    }
  
  
  function shallowCopyInternalPointer(o) {
      return {
          count: o.count,
          deleteScheduled: o.deleteScheduled,
          preservePointerOnDelete: o.preservePointerOnDelete,
          ptr: o.ptr,
          ptrType: o.ptrType,
          smartPtr: o.smartPtr,
          smartPtrType: o.smartPtrType,
      };
    }
  
  function throwInstanceAlreadyDeleted(obj) {
      function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name;
      }
      throwBindingError(getInstanceTypeName(obj) + ' instance already deleted');
    }function ClassHandle_clone() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.preservePointerOnDelete) {
          this.$$.count.value += 1;
          return this;
      } else {
          var clone = Object.create(Object.getPrototypeOf(this), {
              $$: {
                  value: shallowCopyInternalPointer(this.$$),
              }
          });
  
          clone.$$.count.value += 1;
          clone.$$.deleteScheduled = false;
          return clone;
      }
    }
  
  
  function runDestructor(handle) {
      var $$ = handle.$$;
      if ($$.smartPtr) {
          $$.smartPtrType.rawDestructor($$.smartPtr);
      } else {
          $$.ptrType.registeredClass.rawDestructor($$.ptr);
      }
    }function ClassHandle_delete() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
  
      this.$$.count.value -= 1;
      var toDelete = 0 === this.$$.count.value;
      if (toDelete) {
          runDestructor(this);
      }
      if (!this.$$.preservePointerOnDelete) {
          this.$$.smartPtr = undefined;
          this.$$.ptr = undefined;
      }
    }
  
  function ClassHandle_isDeleted() {
      return !this.$$.ptr;
    }
  
  
  var delayFunction=undefined;
  
  var deletionQueue=[];
  
  function flushPendingDeletes() {
      while (deletionQueue.length) {
          var obj = deletionQueue.pop();
          obj.$$.deleteScheduled = false;
          obj['delete']();
      }
    }function ClassHandle_deleteLater() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
      deletionQueue.push(this);
      if (deletionQueue.length === 1 && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
      this.$$.deleteScheduled = true;
      return this;
    }function init_ClassHandle() {
      ClassHandle.prototype['isAliasOf'] = ClassHandle_isAliasOf;
      ClassHandle.prototype['clone'] = ClassHandle_clone;
      ClassHandle.prototype['delete'] = ClassHandle_delete;
      ClassHandle.prototype['isDeleted'] = ClassHandle_isDeleted;
      ClassHandle.prototype['deleteLater'] = ClassHandle_deleteLater;
    }function ClassHandle() {
    }
  
  var registeredPointers={};
  
  
  function ensureOverloadTable(proto, methodName, humanName) {
      if (undefined === proto[methodName].overloadTable) {
          var prevFunc = proto[methodName];
          // Inject an overload resolver function that routes to the appropriate overload based on the number of arguments.
          proto[methodName] = function() {
              // TODO This check can be removed in -O3 level "unsafe" optimizations.
              if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                  throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
              }
              return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
          };
          // Move the previous function into the overload table.
          proto[methodName].overloadTable = [];
          proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    }function exposePublicSymbol(name, value, numArguments) {
      if (Module.hasOwnProperty(name)) {
          if (undefined === numArguments || (undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments])) {
              throwBindingError("Cannot register public name '" + name + "' twice");
          }
  
          // We are exposing a function with the same name as an existing function. Create an overload table and a function selector
          // that routes between the two.
          ensureOverloadTable(Module, name, name);
          if (Module.hasOwnProperty(numArguments)) {
              throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
          }
          // Add the new function into the overload table.
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          if (undefined !== numArguments) {
              Module[name].numArguments = numArguments;
          }
      }
    }
  
  function RegisteredClass(
      name,
      constructor,
      instancePrototype,
      rawDestructor,
      baseClass,
      getActualType,
      upcast,
      downcast
    ) {
      this.name = name;
      this.constructor = constructor;
      this.instancePrototype = instancePrototype;
      this.rawDestructor = rawDestructor;
      this.baseClass = baseClass;
      this.getActualType = getActualType;
      this.upcast = upcast;
      this.downcast = downcast;
      this.pureVirtualFunctions = [];
    }
  
  
  
  function upcastPointer(ptr, ptrClass, desiredClass) {
      while (ptrClass !== desiredClass) {
          if (!ptrClass.upcast) {
              throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
          }
          ptr = ptrClass.upcast(ptr);
          ptrClass = ptrClass.baseClass;
      }
      return ptr;
    }function constNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  function genericPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
  
          if (this.isSmartPointer) {
              var ptr = this.rawConstructor();
              if (destructors !== null) {
                  destructors.push(this.rawDestructor, ptr);
              }
              return ptr;
          } else {
              return 0;
          }
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (!this.isConst && handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
  
      if (this.isSmartPointer) {
          // TODO: this is not strictly true
          // We could support BY_EMVAL conversions from raw pointers to smart pointers
          // because the smart pointer can hold a reference to the handle
          if (undefined === handle.$$.smartPtr) {
              throwBindingError('Passing raw pointer to smart pointer is illegal');
          }
  
          switch (this.sharingPolicy) {
              case 0: // NONE
                  // no upcasting
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
                  }
                  break;
  
              case 1: // INTRUSIVE
                  ptr = handle.$$.smartPtr;
                  break;
  
              case 2: // BY_EMVAL
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      var clonedHandle = handle['clone']();
                      ptr = this.rawShare(
                          ptr,
                          __emval_register(function() {
                              clonedHandle['delete']();
                          })
                      );
                      if (destructors !== null) {
                          destructors.push(this.rawDestructor, ptr);
                      }
                  }
                  break;
  
              default:
                  throwBindingError('Unsupporting sharing policy');
          }
      }
      return ptr;
    }
  
  function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + handle.$$.ptrType.name + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  
  function RegisteredPointer_getPointee(ptr) {
      if (this.rawGetPointee) {
          ptr = this.rawGetPointee(ptr);
      }
      return ptr;
    }
  
  function RegisteredPointer_destructor(ptr) {
      if (this.rawDestructor) {
          this.rawDestructor(ptr);
      }
    }
  
  function RegisteredPointer_deleteObject(handle) {
      if (handle !== null) {
          handle['delete']();
      }
    }
  
  
  function downcastPointer(ptr, ptrClass, desiredClass) {
      if (ptrClass === desiredClass) {
          return ptr;
      }
      if (undefined === desiredClass.baseClass) {
          return null; // no conversion
      }
  
      var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
      if (rv === null) {
          return null;
      }
      return desiredClass.downcast(rv);
    }
  
  
  
  
  function getInheritedInstanceCount() {
      return Object.keys(registeredInstances).length;
    }
  
  function getLiveInheritedInstances() {
      var rv = [];
      for (var k in registeredInstances) {
          if (registeredInstances.hasOwnProperty(k)) {
              rv.push(registeredInstances[k]);
          }
      }
      return rv;
    }
  
  function setDelayFunction(fn) {
      delayFunction = fn;
      if (deletionQueue.length && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
    }function init_embind() {
      Module['getInheritedInstanceCount'] = getInheritedInstanceCount;
      Module['getLiveInheritedInstances'] = getLiveInheritedInstances;
      Module['flushPendingDeletes'] = flushPendingDeletes;
      Module['setDelayFunction'] = setDelayFunction;
    }var registeredInstances={};
  
  function getBasestPointer(class_, ptr) {
      if (ptr === undefined) {
          throwBindingError('ptr should not be undefined');
      }
      while (class_.baseClass) {
          ptr = class_.upcast(ptr);
          class_ = class_.baseClass;
      }
      return ptr;
    }function getInheritedInstance(class_, ptr) {
      ptr = getBasestPointer(class_, ptr);
      return registeredInstances[ptr];
    }
  
  function makeClassHandle(prototype, record) {
      if (!record.ptrType || !record.ptr) {
          throwInternalError('makeClassHandle requires ptr and ptrType');
      }
      var hasSmartPtrType = !!record.smartPtrType;
      var hasSmartPtr = !!record.smartPtr;
      if (hasSmartPtrType !== hasSmartPtr) {
          throwInternalError('Both smartPtrType and smartPtr must be specified');
      }
      record.count = { value: 1 };
      return Object.create(prototype, {
          $$: {
              value: record,
          },
      });
    }function RegisteredPointer_fromWireType(ptr) {
      // ptr is a raw pointer (or a raw smartpointer)
  
      // rawPointer is a maybe-null raw pointer
      var rawPointer = this.getPointee(ptr);
      if (!rawPointer) {
          this.destructor(ptr);
          return null;
      }
  
      var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
      if (undefined !== registeredInstance) {
          // JS object has been neutered, time to repopulate it
          if (0 === registeredInstance.$$.count.value) {
              registeredInstance.$$.ptr = rawPointer;
              registeredInstance.$$.smartPtr = ptr;
              return registeredInstance['clone']();
          } else {
              // else, just increment reference count on existing object
              // it already has a reference to the smart pointer
              var rv = registeredInstance['clone']();
              this.destructor(ptr);
              return rv;
          }
      }
  
      function makeDefaultHandle() {
          if (this.isSmartPointer) {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this.pointeeType,
                  ptr: rawPointer,
                  smartPtrType: this,
                  smartPtr: ptr,
              });
          } else {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this,
                  ptr: ptr,
              });
          }
      }
  
      var actualType = this.registeredClass.getActualType(rawPointer);
      var registeredPointerRecord = registeredPointers[actualType];
      if (!registeredPointerRecord) {
          return makeDefaultHandle.call(this);
      }
  
      var toType;
      if (this.isConst) {
          toType = registeredPointerRecord.constPointerType;
      } else {
          toType = registeredPointerRecord.pointerType;
      }
      var dp = downcastPointer(
          rawPointer,
          this.registeredClass,
          toType.registeredClass);
      if (dp === null) {
          return makeDefaultHandle.call(this);
      }
      if (this.isSmartPointer) {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
              smartPtrType: this,
              smartPtr: ptr,
          });
      } else {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
          });
      }
    }function init_RegisteredPointer() {
      RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
      RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
      RegisteredPointer.prototype['argPackAdvance'] = 8;
      RegisteredPointer.prototype['readValueFromPointer'] = simpleReadValueFromPointer;
      RegisteredPointer.prototype['deleteObject'] = RegisteredPointer_deleteObject;
      RegisteredPointer.prototype['fromWireType'] = RegisteredPointer_fromWireType;
    }function RegisteredPointer(
      name,
      registeredClass,
      isReference,
      isConst,
  
      // smart pointer properties
      isSmartPointer,
      pointeeType,
      sharingPolicy,
      rawGetPointee,
      rawConstructor,
      rawShare,
      rawDestructor
    ) {
      this.name = name;
      this.registeredClass = registeredClass;
      this.isReference = isReference;
      this.isConst = isConst;
  
      // smart pointer properties
      this.isSmartPointer = isSmartPointer;
      this.pointeeType = pointeeType;
      this.sharingPolicy = sharingPolicy;
      this.rawGetPointee = rawGetPointee;
      this.rawConstructor = rawConstructor;
      this.rawShare = rawShare;
      this.rawDestructor = rawDestructor;
  
      if (!isSmartPointer && registeredClass.baseClass === undefined) {
          if (isConst) {
              this['toWireType'] = constNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          } else {
              this['toWireType'] = nonConstNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          }
      } else {
          this['toWireType'] = genericPointerToWireType;
          // Here we must leave this.destructorFunction undefined, since whether genericPointerToWireType returns
          // a pointer that needs to be freed up is runtime-dependent, and cannot be evaluated at registration time.
          // TODO: Create an alternative mechanism that allows removing the use of var destructors = []; array in
          //       craftInvokerFunction altogether.
      }
    }
  
  function replacePublicSymbol(name, value, numArguments) {
      if (!Module.hasOwnProperty(name)) {
          throwInternalError('Replacing nonexistant public symbol');
      }
      // If there's an overload table for this symbol, replace the symbol in the overload table instead.
      if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          Module[name].argCount = numArguments;
      }
    }
  
  function requireFunction(signature, rawFunction) {
      signature = readLatin1String(signature);
  
      function makeDynCaller(dynCall) {
          var args = [];
          for (var i = 1; i < signature.length; ++i) {
              args.push('a' + i);
          }
  
          var name = 'dynCall_' + signature + '_' + rawFunction;
          var body = 'return function ' + name + '(' + args.join(', ') + ') {\n';
          body    += '    return dynCall(rawFunction' + (args.length ? ', ' : '') + args.join(', ') + ');\n';
          body    += '};\n';
  
          return (new Function('dynCall', 'rawFunction', body))(dynCall, rawFunction);
      }
  
      var fp;
      if (Module['FUNCTION_TABLE_' + signature] !== undefined) {
          fp = Module['FUNCTION_TABLE_' + signature][rawFunction];
      } else if (typeof FUNCTION_TABLE !== "undefined") {
          fp = FUNCTION_TABLE[rawFunction];
      } else {
          // asm.js does not give direct access to the function tables,
          // and thus we must go through the dynCall interface which allows
          // calling into a signature's function table by pointer value.
          //
          // https://github.com/dherman/asm.js/issues/83
          //
          // This has three main penalties:
          // - dynCall is another function call in the path from JavaScript to C++.
          // - JITs may not predict through the function table indirection at runtime.
          var dc = Module["asm"]['dynCall_' + signature];
          if (dc === undefined) {
              // We will always enter this branch if the signature
              // contains 'f' and PRECISE_F32 is not enabled.
              //
              // Try again, replacing 'f' with 'd'.
              dc = Module["asm"]['dynCall_' + signature.replace(/f/g, 'd')];
              if (dc === undefined) {
                  throwBindingError("No dynCall invoker for signature: " + signature);
              }
          }
          fp = makeDynCaller(dc);
      }
  
      if (typeof fp !== "function") {
          throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
      }
      return fp;
    }
  
  
  var UnboundTypeError=undefined;
  
  function getTypeName(type) {
      var ptr = ___getTypeName(type);
      var rv = readLatin1String(ptr);
      _free(ptr);
      return rv;
    }function throwUnboundTypeError(message, types) {
      var unboundTypes = [];
      var seen = {};
      function visit(type) {
          if (seen[type]) {
              return;
          }
          if (registeredTypes[type]) {
              return;
          }
          if (typeDependencies[type]) {
              typeDependencies[type].forEach(visit);
              return;
          }
          unboundTypes.push(type);
          seen[type] = true;
      }
      types.forEach(visit);
  
      throw new UnboundTypeError(message + ': ' + unboundTypes.map(getTypeName).join([', ']));
    }function __embind_register_class(
      rawType,
      rawPointerType,
      rawConstPointerType,
      baseClassRawType,
      getActualTypeSignature,
      getActualType,
      upcastSignature,
      upcast,
      downcastSignature,
      downcast,
      name,
      destructorSignature,
      rawDestructor
    ) {
      name = readLatin1String(name);
      getActualType = requireFunction(getActualTypeSignature, getActualType);
      if (upcast) {
          upcast = requireFunction(upcastSignature, upcast);
      }
      if (downcast) {
          downcast = requireFunction(downcastSignature, downcast);
      }
      rawDestructor = requireFunction(destructorSignature, rawDestructor);
      var legalFunctionName = makeLegalFunctionName(name);
  
      exposePublicSymbol(legalFunctionName, function() {
          // this code cannot run if baseClassRawType is zero
          throwUnboundTypeError('Cannot construct ' + name + ' due to unbound types', [baseClassRawType]);
      });
  
      whenDependentTypesAreResolved(
          [rawType, rawPointerType, rawConstPointerType],
          baseClassRawType ? [baseClassRawType] : [],
          function(base) {
              base = base[0];
  
              var baseClass;
              var basePrototype;
              if (baseClassRawType) {
                  baseClass = base.registeredClass;
                  basePrototype = baseClass.instancePrototype;
              } else {
                  basePrototype = ClassHandle.prototype;
              }
  
              var constructor = createNamedFunction(legalFunctionName, function() {
                  if (Object.getPrototypeOf(this) !== instancePrototype) {
                      throw new BindingError("Use 'new' to construct " + name);
                  }
                  if (undefined === registeredClass.constructor_body) {
                      throw new BindingError(name + " has no accessible constructor");
                  }
                  var body = registeredClass.constructor_body[arguments.length];
                  if (undefined === body) {
                      throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
                  }
                  return body.apply(this, arguments);
              });
  
              var instancePrototype = Object.create(basePrototype, {
                  constructor: { value: constructor },
              });
  
              constructor.prototype = instancePrototype;
  
              var registeredClass = new RegisteredClass(
                  name,
                  constructor,
                  instancePrototype,
                  rawDestructor,
                  baseClass,
                  getActualType,
                  upcast,
                  downcast);
  
              var referenceConverter = new RegisteredPointer(
                  name,
                  registeredClass,
                  true,
                  false,
                  false);
  
              var pointerConverter = new RegisteredPointer(
                  name + '*',
                  registeredClass,
                  false,
                  false,
                  false);
  
              var constPointerConverter = new RegisteredPointer(
                  name + ' const*',
                  registeredClass,
                  false,
                  true,
                  false);
  
              registeredPointers[rawType] = {
                  pointerType: pointerConverter,
                  constPointerType: constPointerConverter
              };
  
              replacePublicSymbol(legalFunctionName, constructor);
  
              return [referenceConverter, pointerConverter, constPointerConverter];
          }
      );
    }

  function ___lock() {}

  function ___unlock() {}

  
  var emval_free_list=[];
  
  var emval_handle_array=[{},{value:undefined},{value:null},{value:true},{value:false}];function __emval_decref(handle) {
      if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
          emval_handle_array[handle] = undefined;
          emval_free_list.push(handle);
      }
    }

  
  var PTHREAD_SPECIFIC={};function _pthread_getspecific(key) {
      return PTHREAD_SPECIFIC[key] || 0;
    }

   
  Module["_i64Add"] = _i64Add;

  
  var PTHREAD_SPECIFIC_NEXT_KEY=1;
  
  var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _pthread_key_create(key, destructor) {
      if (key == 0) {
        return ERRNO_CODES.EINVAL;
      }
      HEAP32[((key)>>2)]=PTHREAD_SPECIFIC_NEXT_KEY;
      // values start at 0
      PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
      PTHREAD_SPECIFIC_NEXT_KEY++;
      return 0;
    }

  
  
  
  function count_emval_handles() {
      var count = 0;
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              ++count;
          }
      }
      return count;
    }
  
  function get_first_emval() {
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              return emval_handle_array[i];
          }
      }
      return null;
    }function init_emval() {
      Module['count_emval_handles'] = count_emval_handles;
      Module['get_first_emval'] = get_first_emval;
    }function __emval_register(value) {
  
      switch(value){
        case undefined :{ return 1; }
        case null :{ return 2; }
        case true :{ return 3; }
        case false :{ return 4; }
        default:{
          var handle = emval_free_list.length ?
              emval_free_list.pop() :
              emval_handle_array.length;
  
          emval_handle_array[handle] = {refcount: 1, value: value};
          return handle;
          }
        }
    }
  
  function requireRegisteredType(rawType, humanName) {
      var impl = registeredTypes[rawType];
      if (undefined === impl) {
          throwBindingError(humanName + " has unknown type " + getTypeName(rawType));
      }
      return impl;
    }function __emval_take_value(type, argv) {
      type = requireRegisteredType(type, '_emval_take_value');
      var v = type['readValueFromPointer'](argv);
      return __emval_register(v);
    }

  function __embind_register_emval(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(handle) {
              var rv = emval_handle_array[handle].value;
              __emval_decref(handle);
              return rv;
          },
          'toWireType': function(destructors, value) {
              return __emval_register(value);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: null, // This type does not need a destructor
  
          // TODO: do we need a deleteObject here?  write a test where
          // emval is passed into JS via an interface
      });
    }

  function _pthread_setspecific(key, value) {
      if (!(key in PTHREAD_SPECIFIC)) {
        return ERRNO_CODES.EINVAL;
      }
      PTHREAD_SPECIFIC[key] = value;
      return 0;
    }

  function ___cxa_allocate_exception(size) {
      return _malloc(size);
    }

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

   
  Module["_bitshift64Lshr"] = _bitshift64Lshr;

  
  function heap32VectorToArray(count, firstElement) {
      var array = [];
      for (var i = 0; i < count; i++) {
          array.push(HEAP32[(firstElement >> 2) + i]);
      }
      return array;
    }
  
  function runDestructors(destructors) {
      while (destructors.length) {
          var ptr = destructors.pop();
          var del = destructors.pop();
          del(ptr);
      }
    }function __embind_register_class_constructor(
      rawClassType,
      argCount,
      rawArgTypesAddr,
      invokerSignature,
      invoker,
      rawConstructor
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      invoker = requireFunction(invokerSignature, invoker);
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = 'constructor ' + classType.name;
  
          if (undefined === classType.registeredClass.constructor_body) {
              classType.registeredClass.constructor_body = [];
          }
          if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
              throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount-1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
          }
          classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
              throwUnboundTypeError('Cannot construct ' + classType.name + ' due to unbound types', rawArgTypes);
          };
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
              classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
                  if (arguments.length !== argCount - 1) {
                      throwBindingError(humanName + ' called with ' + arguments.length + ' arguments, expected ' + (argCount-1));
                  }
                  var destructors = [];
                  var args = new Array(argCount);
                  args[0] = rawConstructor;
                  for (var i = 1; i < argCount; ++i) {
                      args[i] = argTypes[i]['toWireType'](destructors, arguments[i - 1]);
                  }
  
                  var ptr = invoker.apply(null, args);
                  runDestructors(destructors);
  
                  return argTypes[0]['fromWireType'](ptr);
              };
              return [];
          });
          return [];
      });
    }

  
  function floatReadValueFromPointer(name, shift) {
      switch (shift) {
          case 2: return function(pointer) {
              return this['fromWireType'](HEAPF32[pointer >> 2]);
          };
          case 3: return function(pointer) {
              return this['fromWireType'](HEAPF64[pointer >> 3]);
          };
          default:
              throw new TypeError("Unknown float type: " + name);
      }
    }function __embind_register_float(rawType, name, size) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              return value;
          },
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following if() and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              return value;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': floatReadValueFromPointer(name, shift),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  
  
  function new_(constructor, argumentList) {
      if (!(constructor instanceof Function)) {
          throw new TypeError('new_ called with constructor type ' + typeof(constructor) + " which is not a function");
      }
  
      /*
       * Previously, the following line was just:
  
       function dummy() {};
  
       * Unfortunately, Chrome was preserving 'dummy' as the object's name, even though at creation, the 'dummy' has the
       * correct constructor name.  Thus, objects created with IMVU.new would show up in the debugger as 'dummy', which
       * isn't very helpful.  Using IMVU.createNamedFunction addresses the issue.  Doublely-unfortunately, there's no way
       * to write a test for this behavior.  -NRD 2013.02.22
       */
      var dummy = createNamedFunction(constructor.name || 'unknownFunctionName', function(){});
      dummy.prototype = constructor.prototype;
      var obj = new dummy;
  
      var r = constructor.apply(obj, argumentList);
      return (r instanceof Object) ? r : obj;
    }function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
      // humanName: a human-readable string name for the function to be generated.
      // argTypes: An array that contains the embind type objects for all types in the function signature.
      //    argTypes[0] is the type object for the function return value.
      //    argTypes[1] is the type object for function this object/class type, or null if not crafting an invoker for a class method.
      //    argTypes[2...] are the actual function parameters.
      // classType: The embind type object for the class to be bound, or null if this is not a method of a class.
      // cppInvokerFunc: JS Function object to the C++-side function that interops into C++ code.
      // cppTargetFunc: Function pointer (an integer to FUNCTION_TABLE) to the target C++ function the cppInvokerFunc will end up calling.
      var argCount = argTypes.length;
  
      if (argCount < 2) {
          throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
      }
  
      var isClassMethodFunc = (argTypes[1] !== null && classType !== null);
  
      // Free functions with signature "void function()" do not need an invoker that marshalls between wire types.
  // TODO: This omits argument count check - enable only at -O3 or similar.
  //    if (ENABLE_UNSAFE_OPTS && argCount == 2 && argTypes[0].name == "void" && !isClassMethodFunc) {
  //       return FUNCTION_TABLE[fn];
  //    }
  
      var argsList = "";
      var argsListWired = "";
      for(var i = 0; i < argCount - 2; ++i) {
          argsList += (i!==0?", ":"")+"arg"+i;
          argsListWired += (i!==0?", ":"")+"arg"+i+"Wired";
      }
  
      var invokerFnBody =
          "return function "+makeLegalFunctionName(humanName)+"("+argsList+") {\n" +
          "if (arguments.length !== "+(argCount - 2)+") {\n" +
              "throwBindingError('function "+humanName+" called with ' + arguments.length + ' arguments, expected "+(argCount - 2)+" args!');\n" +
          "}\n";
  
  
      // Determine if we need to use a dynamic stack to store the destructors for the function parameters.
      // TODO: Remove this completely once all function invokers are being dynamically generated.
      var needsDestructorStack = false;
  
      for(var i = 1; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here.
          if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) { // The type does not define a destructor function - must use dynamic stack
              needsDestructorStack = true;
              break;
          }
      }
  
      if (needsDestructorStack) {
          invokerFnBody +=
              "var destructors = [];\n";
      }
  
      var dtorStack = needsDestructorStack ? "destructors" : "null";
      var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
      var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
  
  
      if (isClassMethodFunc) {
          invokerFnBody += "var thisWired = classParam.toWireType("+dtorStack+", this);\n";
      }
  
      for(var i = 0; i < argCount - 2; ++i) {
          invokerFnBody += "var arg"+i+"Wired = argType"+i+".toWireType("+dtorStack+", arg"+i+"); // "+argTypes[i+2].name+"\n";
          args1.push("argType"+i);
          args2.push(argTypes[i+2]);
      }
  
      if (isClassMethodFunc) {
          argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
      }
  
      var returns = (argTypes[0].name !== "void");
  
      invokerFnBody +=
          (returns?"var rv = ":"") + "invoker(fn"+(argsListWired.length>0?", ":"")+argsListWired+");\n";
  
      if (needsDestructorStack) {
          invokerFnBody += "runDestructors(destructors);\n";
      } else {
          for(var i = isClassMethodFunc?1:2; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here. Also skip class type if not a method.
              var paramName = (i === 1 ? "thisWired" : ("arg"+(i - 2)+"Wired"));
              if (argTypes[i].destructorFunction !== null) {
                  invokerFnBody += paramName+"_dtor("+paramName+"); // "+argTypes[i].name+"\n";
                  args1.push(paramName+"_dtor");
                  args2.push(argTypes[i].destructorFunction);
              }
          }
      }
  
      if (returns) {
          invokerFnBody += "var ret = retType.fromWireType(rv);\n" +
                           "return ret;\n";
      } else {
      }
      invokerFnBody += "}\n";
  
      args1.push(invokerFnBody);
  
      var invokerFunction = new_(Function, args1).apply(null, args2);
      return invokerFunction;
    }function __embind_register_function(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
      var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      name = readLatin1String(name);
      
      rawInvoker = requireFunction(signature, rawInvoker);
  
      exposePublicSymbol(name, function() {
          throwUnboundTypeError('Cannot call ' + name + ' due to unbound types', argTypes);
      }, argCount - 1);
  
      whenDependentTypesAreResolved([], argTypes, function(argTypes) {
          var invokerArgsArray = [argTypes[0] /* return value */, null /* no class 'this'*/].concat(argTypes.slice(1) /* actual params */);
          replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null /* no class 'this'*/, rawInvoker, fn), argCount - 1);
          return [];
      });
    }

  function ___cxa_begin_catch(ptr) {
      var info = EXCEPTIONS.infos[ptr];
      if (info && !info.caught) {
        info.caught = true;
        __ZSt18uncaught_exceptionv.uncaught_exception--;
      }
      if (info) info.rethrown = false;
      EXCEPTIONS.caught.push(ptr);
      EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
      return ptr;
    }

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 
  Module["_memcpy"] = _memcpy;

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  
  var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_STATIC); 
  Module["_llvm_cttz_i32"] = _llvm_cttz_i32; 
  Module["___udivmoddi4"] = ___udivmoddi4; 
  Module["___udivdi3"] = ___udivdi3;

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      return value;
    } 
  Module["_sbrk"] = _sbrk;

   
  Module["_memmove"] = _memmove;

  function __embind_register_std_wstring(rawType, charSize, name) {
      // nb. do not cache HEAPU16 and HEAPU32, they may be destroyed by enlargeMemory().
      name = readLatin1String(name);
      var getHeap, shift;
      if (charSize === 2) {
          getHeap = function() { return HEAPU16; };
          shift = 1;
      } else if (charSize === 4) {
          getHeap = function() { return HEAPU32; };
          shift = 2;
      }
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var HEAP = getHeap();
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              var start = (value + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAP[start + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              // assumes 4-byte alignment
              var HEAP = getHeap();
              var length = value.length;
              var ptr = _malloc(4 + length * charSize);
              HEAPU32[ptr >> 2] = length;
              var start = (ptr + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  HEAP[start + i] = value.charCodeAt(i);
              }
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  function ___gxx_personality_v0() {
    }

   
  Module["___uremdi3"] = ___uremdi3;

   
  Module["_llvm_bswap_i32"] = _llvm_bswap_i32;

  function __embind_register_memory_view(rawType, dataTypeIndex, name) {
      var typeMapping = [
          Int8Array,
          Uint8Array,
          Int16Array,
          Uint16Array,
          Int32Array,
          Uint32Array,
          Float32Array,
          Float64Array,
      ];
  
      var TA = typeMapping[dataTypeIndex];
  
      function decodeMemoryView(handle) {
          handle = handle >> 2;
          var heap = HEAPU32;
          var size = heap[handle]; // in elements
          var data = heap[handle + 1]; // byte offset into emscripten heap
          return new TA(heap['buffer'], data, size);
      }
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': decodeMemoryView,
          'argPackAdvance': 8,
          'readValueFromPointer': decodeMemoryView,
      }, {
          ignoreDuplicateRegistrations: true,
      });
    }

  function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      var offset = offset_low;
      assert(offset_high === 0);
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function __emval_incref(handle) {
      if (handle > 4) {
          emval_handle_array[handle].refcount += 1;
      }
    }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffer) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function __embind_register_class_function(
      rawClassType,
      methodName,
      argCount,
      rawArgTypesAddr, // [ReturnType, ThisType, Args...]
      invokerSignature,
      rawInvoker,
      context,
      isPureVirtual
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      methodName = readLatin1String(methodName);
      rawInvoker = requireFunction(invokerSignature, rawInvoker);
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = classType.name + '.' + methodName;
  
          if (isPureVirtual) {
              classType.registeredClass.pureVirtualFunctions.push(methodName);
          }
  
          function unboundTypesHandler() {
              throwUnboundTypeError('Cannot call ' + humanName + ' due to unbound types', rawArgTypes);
          }
  
          var proto = classType.registeredClass.instancePrototype;
          var method = proto[methodName];
          if (undefined === method || (undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2)) {
              // This is the first overload to be registered, OR we are replacing a function in the base class with a function in the derived class.
              unboundTypesHandler.argCount = argCount - 2;
              unboundTypesHandler.className = classType.name;
              proto[methodName] = unboundTypesHandler;
          } else {
              // There was an existing function with the same name registered. Set up a function overload routing table.
              ensureOverloadTable(proto, methodName, humanName);
              proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
          }
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
  
              var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
  
              // Replace the initial unbound-handler-stub function with the appropriate member function, now that all types
              // are resolved. If multiple overloads are registered for this function, the function goes into an overload table.
              if (undefined === proto[methodName].overloadTable) {
                  // Set argCount in case an overload is registered later
                  memberFunction.argCount = argCount - 2;
                  proto[methodName] = memberFunction;
              } else {
                  proto[methodName].overloadTable[argCount - 2] = memberFunction;
              }
  
              return [];
          });
          return [];
      });
    }
embind_init_charCodes();
BindingError = Module['BindingError'] = extendError(Error, 'BindingError');;
InternalError = Module['InternalError'] = extendError(Error, 'InternalError');;
init_ClassHandle();
init_RegisteredPointer();
init_embind();;
UnboundTypeError = Module['UnboundTypeError'] = extendError(Error, 'UnboundTypeError');;
init_emval();;
/* flush anything remaining in the buffer during shutdown */ __ATEXIT__.push(function() { var fflush = Module["_fflush"]; if (fflush) fflush(0); var printChar = ___syscall146.printChar; if (!printChar) return; var buffers = ___syscall146.buffers; if (buffers[1].length) printChar(1, 10); if (buffers[2].length) printChar(2, 10); });;
DYNAMICTOP_PTR = allocate(1, "i32", ALLOC_STATIC);

STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = Runtime.alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory



function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  try {
    Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_i(index) {
  try {
    return Module["dynCall_i"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viii(index,a1,a2,a3) {
  try {
    Module["dynCall_viii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_v(index) {
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiiii(index,a1,a2,a3,a4) {
  try {
    return Module["dynCall_iiiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  try {
    Module["dynCall_viiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiii(index,a1,a2,a3,a4) {
  try {
    Module["dynCall_viiii"](index,a1,a2,a3,a4);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "invoke_iiii": invoke_iiii, "invoke_viiiii": invoke_viiiii, "invoke_i": invoke_i, "invoke_vi": invoke_vi, "invoke_vii": invoke_vii, "invoke_ii": invoke_ii, "invoke_viii": invoke_viii, "invoke_v": invoke_v, "invoke_iiiii": invoke_iiiii, "invoke_viiiiii": invoke_viiiiii, "invoke_iii": invoke_iii, "invoke_viiii": invoke_viiii, "floatReadValueFromPointer": floatReadValueFromPointer, "simpleReadValueFromPointer": simpleReadValueFromPointer, "throwInternalError": throwInternalError, "get_first_emval": get_first_emval, "getLiveInheritedInstances": getLiveInheritedInstances, "___assert_fail": ___assert_fail, "__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv, "ClassHandle": ClassHandle, "getShiftFromSize": getShiftFromSize, "___cxa_begin_catch": ___cxa_begin_catch, "_emscripten_memcpy_big": _emscripten_memcpy_big, "runDestructor": runDestructor, "throwInstanceAlreadyDeleted": throwInstanceAlreadyDeleted, "__embind_register_std_string": __embind_register_std_string, "init_RegisteredPointer": init_RegisteredPointer, "ClassHandle_isAliasOf": ClassHandle_isAliasOf, "flushPendingDeletes": flushPendingDeletes, "makeClassHandle": makeClassHandle, "whenDependentTypesAreResolved": whenDependentTypesAreResolved, "__embind_register_class_constructor": __embind_register_class_constructor, "init_ClassHandle": init_ClassHandle, "___syscall140": ___syscall140, "ClassHandle_clone": ClassHandle_clone, "___syscall146": ___syscall146, "RegisteredClass": RegisteredClass, "___cxa_find_matching_catch": ___cxa_find_matching_catch, "embind_init_charCodes": embind_init_charCodes, "___setErrNo": ___setErrNo, "__embind_register_bool": __embind_register_bool, "___resumeException": ___resumeException, "createNamedFunction": createNamedFunction, "__embind_register_emval": __embind_register_emval, "__emval_decref": __emval_decref, "_pthread_once": _pthread_once, "__embind_register_class": __embind_register_class, "constNoSmartPtrRawPointerToWireType": constNoSmartPtrRawPointerToWireType, "heap32VectorToArray": heap32VectorToArray, "ClassHandle_delete": ClassHandle_delete, "RegisteredPointer_destructor": RegisteredPointer_destructor, "___syscall6": ___syscall6, "ensureOverloadTable": ensureOverloadTable, "new_": new_, "downcastPointer": downcastPointer, "replacePublicSymbol": replacePublicSymbol, "init_embind": init_embind, "ClassHandle_deleteLater": ClassHandle_deleteLater, "___syscall54": ___syscall54, "RegisteredPointer_deleteObject": RegisteredPointer_deleteObject, "ClassHandle_isDeleted": ClassHandle_isDeleted, "__embind_register_integer": __embind_register_integer, "___cxa_allocate_exception": ___cxa_allocate_exception, "__emval_take_value": __emval_take_value, "_embind_repr": _embind_repr, "_pthread_getspecific": _pthread_getspecific, "RegisteredPointer": RegisteredPointer, "craftInvokerFunction": craftInvokerFunction, "runDestructors": runDestructors, "requireRegisteredType": requireRegisteredType, "makeLegalFunctionName": makeLegalFunctionName, "_pthread_key_create": _pthread_key_create, "upcastPointer": upcastPointer, "init_emval": init_emval, "shallowCopyInternalPointer": shallowCopyInternalPointer, "nonConstNoSmartPtrRawPointerToWireType": nonConstNoSmartPtrRawPointerToWireType, "_abort": _abort, "throwBindingError": throwBindingError, "getTypeName": getTypeName, "exposePublicSymbol": exposePublicSymbol, "RegisteredPointer_fromWireType": RegisteredPointer_fromWireType, "___lock": ___lock, "__embind_register_memory_view": __embind_register_memory_view, "getInheritedInstance": getInheritedInstance, "setDelayFunction": setDelayFunction, "___gxx_personality_v0": ___gxx_personality_v0, "extendError": extendError, "__embind_register_void": __embind_register_void, "__embind_register_function": __embind_register_function, "RegisteredPointer_getPointee": RegisteredPointer_getPointee, "__emval_register": __emval_register, "__embind_register_std_wstring": __embind_register_std_wstring, "__embind_register_class_function": __embind_register_class_function, "__emval_incref": __emval_incref, "throwUnboundTypeError": throwUnboundTypeError, "readLatin1String": readLatin1String, "getBasestPointer": getBasestPointer, "getInheritedInstanceCount": getInheritedInstanceCount, "__embind_register_float": __embind_register_float, "integerReadValueFromPointer": integerReadValueFromPointer, "___unlock": ___unlock, "_pthread_setspecific": _pthread_setspecific, "genericPointerToWireType": genericPointerToWireType, "registerType": registerType, "___cxa_throw": ___cxa_throw, "count_emval_handles": count_emval_handles, "requireFunction": requireFunction, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "cttz_i8": cttz_i8 };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
  'use asm';
  
  
  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);


  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntP = 0, tempBigIntS = 0, tempBigIntR = 0.0, tempBigIntI = 0, tempBigIntD = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var invoke_iiii=env.invoke_iiii;
  var invoke_viiiii=env.invoke_viiiii;
  var invoke_i=env.invoke_i;
  var invoke_vi=env.invoke_vi;
  var invoke_vii=env.invoke_vii;
  var invoke_ii=env.invoke_ii;
  var invoke_viii=env.invoke_viii;
  var invoke_v=env.invoke_v;
  var invoke_iiiii=env.invoke_iiiii;
  var invoke_viiiiii=env.invoke_viiiiii;
  var invoke_iii=env.invoke_iii;
  var invoke_viiii=env.invoke_viiii;
  var floatReadValueFromPointer=env.floatReadValueFromPointer;
  var simpleReadValueFromPointer=env.simpleReadValueFromPointer;
  var throwInternalError=env.throwInternalError;
  var get_first_emval=env.get_first_emval;
  var getLiveInheritedInstances=env.getLiveInheritedInstances;
  var ___assert_fail=env.___assert_fail;
  var __ZSt18uncaught_exceptionv=env.__ZSt18uncaught_exceptionv;
  var ClassHandle=env.ClassHandle;
  var getShiftFromSize=env.getShiftFromSize;
  var ___cxa_begin_catch=env.___cxa_begin_catch;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var runDestructor=env.runDestructor;
  var throwInstanceAlreadyDeleted=env.throwInstanceAlreadyDeleted;
  var __embind_register_std_string=env.__embind_register_std_string;
  var init_RegisteredPointer=env.init_RegisteredPointer;
  var ClassHandle_isAliasOf=env.ClassHandle_isAliasOf;
  var flushPendingDeletes=env.flushPendingDeletes;
  var makeClassHandle=env.makeClassHandle;
  var whenDependentTypesAreResolved=env.whenDependentTypesAreResolved;
  var __embind_register_class_constructor=env.__embind_register_class_constructor;
  var init_ClassHandle=env.init_ClassHandle;
  var ___syscall140=env.___syscall140;
  var ClassHandle_clone=env.ClassHandle_clone;
  var ___syscall146=env.___syscall146;
  var RegisteredClass=env.RegisteredClass;
  var ___cxa_find_matching_catch=env.___cxa_find_matching_catch;
  var embind_init_charCodes=env.embind_init_charCodes;
  var ___setErrNo=env.___setErrNo;
  var __embind_register_bool=env.__embind_register_bool;
  var ___resumeException=env.___resumeException;
  var createNamedFunction=env.createNamedFunction;
  var __embind_register_emval=env.__embind_register_emval;
  var __emval_decref=env.__emval_decref;
  var _pthread_once=env._pthread_once;
  var __embind_register_class=env.__embind_register_class;
  var constNoSmartPtrRawPointerToWireType=env.constNoSmartPtrRawPointerToWireType;
  var heap32VectorToArray=env.heap32VectorToArray;
  var ClassHandle_delete=env.ClassHandle_delete;
  var RegisteredPointer_destructor=env.RegisteredPointer_destructor;
  var ___syscall6=env.___syscall6;
  var ensureOverloadTable=env.ensureOverloadTable;
  var new_=env.new_;
  var downcastPointer=env.downcastPointer;
  var replacePublicSymbol=env.replacePublicSymbol;
  var init_embind=env.init_embind;
  var ClassHandle_deleteLater=env.ClassHandle_deleteLater;
  var ___syscall54=env.___syscall54;
  var RegisteredPointer_deleteObject=env.RegisteredPointer_deleteObject;
  var ClassHandle_isDeleted=env.ClassHandle_isDeleted;
  var __embind_register_integer=env.__embind_register_integer;
  var ___cxa_allocate_exception=env.___cxa_allocate_exception;
  var __emval_take_value=env.__emval_take_value;
  var _embind_repr=env._embind_repr;
  var _pthread_getspecific=env._pthread_getspecific;
  var RegisteredPointer=env.RegisteredPointer;
  var craftInvokerFunction=env.craftInvokerFunction;
  var runDestructors=env.runDestructors;
  var requireRegisteredType=env.requireRegisteredType;
  var makeLegalFunctionName=env.makeLegalFunctionName;
  var _pthread_key_create=env._pthread_key_create;
  var upcastPointer=env.upcastPointer;
  var init_emval=env.init_emval;
  var shallowCopyInternalPointer=env.shallowCopyInternalPointer;
  var nonConstNoSmartPtrRawPointerToWireType=env.nonConstNoSmartPtrRawPointerToWireType;
  var _abort=env._abort;
  var throwBindingError=env.throwBindingError;
  var getTypeName=env.getTypeName;
  var exposePublicSymbol=env.exposePublicSymbol;
  var RegisteredPointer_fromWireType=env.RegisteredPointer_fromWireType;
  var ___lock=env.___lock;
  var __embind_register_memory_view=env.__embind_register_memory_view;
  var getInheritedInstance=env.getInheritedInstance;
  var setDelayFunction=env.setDelayFunction;
  var ___gxx_personality_v0=env.___gxx_personality_v0;
  var extendError=env.extendError;
  var __embind_register_void=env.__embind_register_void;
  var __embind_register_function=env.__embind_register_function;
  var RegisteredPointer_getPointee=env.RegisteredPointer_getPointee;
  var __emval_register=env.__emval_register;
  var __embind_register_std_wstring=env.__embind_register_std_wstring;
  var __embind_register_class_function=env.__embind_register_class_function;
  var __emval_incref=env.__emval_incref;
  var throwUnboundTypeError=env.throwUnboundTypeError;
  var readLatin1String=env.readLatin1String;
  var getBasestPointer=env.getBasestPointer;
  var getInheritedInstanceCount=env.getInheritedInstanceCount;
  var __embind_register_float=env.__embind_register_float;
  var integerReadValueFromPointer=env.integerReadValueFromPointer;
  var ___unlock=env.___unlock;
  var _pthread_setspecific=env._pthread_setspecific;
  var genericPointerToWireType=env.genericPointerToWireType;
  var registerType=env.registerType;
  var ___cxa_throw=env.___cxa_throw;
  var count_emval_handles=env.count_emval_handles;
  var requireFunction=env.requireFunction;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function _deflate($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$$i = 0, $$$i$i = 0, $$$i$i424 = 0, $$$i138$i = 0, $$$i140$i = 0, $$$i403 = 0, $$$i405 = 0, $$$i407 = 0, $$$i409 = 0, $$$i411 = 0, $$$i413 = 0, $$$i415 = 0, $$$i417 = 0, $$$i419 = 0, $$$i421 = 0, $$$i52$i = 0, $$$i54$i = 0, $$0128$i = 0, $$0382 = 0, $$0385 = 0, $$0387 = 0, $$0388$lcssa = 0, $$0388454 = 0, $$0390$lcssa = 0, $$1$i = 0, $$1383 = 0, $$1386 = 0, $$14 = 0, $$add$i = 0, $$idx$i = 0, $$pr428 = 0, $$pr440 = 0, $$pre$phi479Z2D = 0, $$pre$phi481Z2D = 0, $$pre$phi483Z2D = 0, $$pre$phi485Z2D = 0, $$pre462 = 0, $$pre463 = 0, $$pre477 = 0, $$ptr$i = 0, $$ptr131$i = 0, $$ptr132$i = 0, $$ptr135$i = 0, $10 = 0, $100 = 0, $1000 = 0, $1002 = 0, $1008 = 0, $101 = 0, $1014 = 0, $1024 = 0, $1030 = 0, $1032 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1041 = 0, $1043 = 0, $1049 = 0, $105 = 0, $1055 = 0, $1067 = 0, $1076 = 0, $1079 = 0, $1089 = 0, $1090 = 0, $1091 = 0, $1092 = 0, $1096 = 0, $1102 = 0, $1106 = 0, $1108 = 0, $111 = 0, $1112 = 0, $1114 = 0, $1115 = 0, $1118 = 0, $1119 = 0, $1121 = 0, $1123 = 0, $1128 = 0, $1129 = 0, $1135 = 0, $1136 = 0, $1142 = 0, $1143 = 0, $1147 = 0, $1149 = 0, $115 = 0, $1150 = 0, $1156 = 0, $1157 = 0, $1163 = 0, $1164 = 0, $1170 = 0, $1171 = 0, $1178 = 0, $1180 = 0, $1184 = 0, $1188 = 0, $1191 = 0, $1196 = 0, $120 = 0, $1200 = 0, $1201 = 0, $1202 = 0, $1203 = 0, $1207 = 0, $1213 = 0, $1219 = 0, $1223 = 0, $1228 = 0, $124 = 0, $127 = 0, $132 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $144 = 0, $15 = 0, $150 = 0, $156 = 0, $162 = 0, $165 = 0, $166 = 0, $168 = 0, $17 = 0, $171 = 0, $175 = 0, $179 = 0, $180 = 0, $182 = 0, $186 = 0, $190 = 0, $194 = 0, $198 = 0, $20 = 0, $203 = 0, $211 = 0, $212 = 0, $216 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $227 = 0, $233 = 0, $239 = 0, $26 = 0, $268 = 0, $269 = 0, $276 = 0, $277 = 0, $285 = 0, $286 = 0, $29 = 0, $294 = 0, $295 = 0, $303 = 0, $304 = 0, $309 = 0, $317 = 0, $318 = 0, $325 = 0, $326 = 0, $330 = 0, $336 = 0, $337 = 0, $34 = 0, $345 = 0, $346 = 0, $35 = 0, $351 = 0, $359 = 0, $36 = 0, $361 = 0, $363 = 0, $367 = 0, $368 = 0, $369 = 0, $371 = 0, $372 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $383 = 0, $384 = 0, $385 = 0, $39 = 0, $398 = 0, $399 = 0, $40 = 0, $400 = 0, $401 = 0, $405 = 0, $416 = 0, $422 = 0, $428 = 0, $429 = 0, $431 = 0, $437 = 0, $44 = 0, $447 = 0, $448 = 0, $449 = 0, $450 = 0, $451 = 0, $452 = 0, $454 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $473 = 0, $484 = 0, $490 = 0, $496 = 0, $498 = 0, $50 = 0, $506 = 0, $517 = 0, $518 = 0, $519 = 0, $520 = 0, $521 = 0, $522 = 0, $524 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $543 = 0, $554 = 0, $56 = 0, $560 = 0, $566 = 0, $568 = 0, $576 = 0, $587 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $599 = 0, $60 = 0, $605 = 0, $611 = 0, $617 = 0, $619 = 0, $621 = 0, $622 = 0, $627 = 0, $628 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $640 = 0, $646 = 0, $652 = 0, $666 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $688 = 0, $689 = 0, $696 = 0, $702 = 0, $706 = 0, $707 = 0, $712 = 0, $714 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $720 = 0, $723 = 0, $725 = 0, $731 = 0, $737 = 0, $747 = 0, $753 = 0, $755 = 0, $757 = 0, $758 = 0, $759 = 0, $760 = 0, $761 = 0, $764 = 0, $766 = 0, $772 = 0, $778 = 0, $788 = 0, $794 = 0, $796 = 0, $798 = 0, $799 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $805 = 0, $807 = 0, $813 = 0, $819 = 0, $827 = 0, $828 = 0, $829 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $839 = 0, $843 = 0, $846 = 0, $847 = 0, $85 = 0, $855 = 0, $856 = 0, $859 = 0, $862 = 0, $865 = 0, $868 = 0, $871 = 0, $882 = 0, $884 = 0, $886 = 0, $888 = 0, $89 = 0, $9 = 0, $90 = 0, $900 = 0, $905 = 0, $912 = 0, $913 = 0, $917 = 0, $920 = 0, $921 = 0, $922 = 0, $929 = 0, $936 = 0, $94 = 0, $940 = 0, $942 = 0, $947 = 0, $948 = 0, $950 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $959 = 0, $961 = 0, $967 = 0, $973 = 0, $983 = 0, $989 = 0, $991 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, label = 0, $$idx$i$looptemp = 0;
 if (!$0) {
  $$14 = -2;
  return $$14 | 0;
 }
 if (!(HEAP32[$0 + 32 >> 2] | 0)) {
  $$14 = -2;
  return $$14 | 0;
 }
 if (!(HEAP32[$0 + 36 >> 2] | 0)) {
  $$14 = -2;
  return $$14 | 0;
 }
 $9 = $0 + 28 | 0;
 $10 = HEAP32[$9 >> 2] | 0;
 if (!$10) {
  $$14 = -2;
  return $$14 | 0;
 }
 if ((HEAP32[$10 >> 2] | 0) != ($0 | 0)) {
  $$14 = -2;
  return $$14 | 0;
 }
 $14 = $10 + 4 | 0;
 $15 = HEAP32[$14 >> 2] | 0;
 switch ($15 | 0) {
 case 666:
 case 113:
 case 103:
 case 91:
 case 73:
 case 69:
 case 57:
 case 42:
  break;
 default:
  {
   $$14 = -2;
   return $$14 | 0;
  }
 }
 if ($1 >>> 0 > 5) {
  $$14 = -2;
  return $$14 | 0;
 }
 $17 = $0 + 12 | 0;
 do if (HEAP32[$17 >> 2] | 0) {
  $20 = $0 + 4 | 0;
  $22 = (HEAP32[$20 >> 2] | 0) == 0;
  if (!$22) if (!(HEAP32[$0 >> 2] | 0)) break;
  $26 = ($1 | 0) != 4;
  if (!($26 & ($15 | 0) == 666)) {
   $29 = $0 + 16 | 0;
   if (!(HEAP32[$29 >> 2] | 0)) {
    HEAP32[$0 + 24 >> 2] = HEAP32[397];
    $$14 = -5;
    return $$14 | 0;
   }
   $34 = $10 + 40 | 0;
   $35 = HEAP32[$34 >> 2] | 0;
   HEAP32[$34 >> 2] = $1;
   $36 = $10 + 20 | 0;
   do if (!(HEAP32[$36 >> 2] | 0)) if ($22) if ($26 & (($1 << 1) - (($1 | 0) > 4 ? 9 : 0) | 0) <= (($35 << 1) - (($35 | 0) > 4 ? 9 : 0) | 0)) {
    HEAP32[$0 + 24 >> 2] = HEAP32[397];
    $$14 = -5;
    return $$14 | 0;
   } else {
    $$pr428 = $15;
    $100 = 0;
   } else {
    $$pr428 = $15;
    $100 = 0;
   } else {
    __tr_flush_bits($10);
    $39 = HEAP32[$36 >> 2] | 0;
    $40 = HEAP32[$29 >> 2] | 0;
    $$$i403 = $39 >>> 0 > $40 >>> 0 ? $40 : $39;
    if (!$$$i403) {
     $1228 = $39;
     $60 = $40;
    } else {
     $44 = $10 + 16 | 0;
     _memcpy(HEAP32[$17 >> 2] | 0, HEAP32[$44 >> 2] | 0, $$$i403 | 0) | 0;
     HEAP32[$17 >> 2] = (HEAP32[$17 >> 2] | 0) + $$$i403;
     HEAP32[$44 >> 2] = (HEAP32[$44 >> 2] | 0) + $$$i403;
     $50 = $0 + 20 | 0;
     HEAP32[$50 >> 2] = (HEAP32[$50 >> 2] | 0) + $$$i403;
     $54 = (HEAP32[$29 >> 2] | 0) - $$$i403 | 0;
     HEAP32[$29 >> 2] = $54;
     $56 = (HEAP32[$36 >> 2] | 0) - $$$i403 | 0;
     HEAP32[$36 >> 2] = $56;
     if (!$56) {
      HEAP32[$44 >> 2] = HEAP32[$10 + 8 >> 2];
      $1228 = 0;
      $60 = $54;
     } else {
      $1228 = $56;
      $60 = $54;
     }
    }
    if ($60 | 0) {
     $$pr428 = HEAP32[$14 >> 2] | 0;
     $100 = $1228;
     break;
    }
    HEAP32[$34 >> 2] = -1;
    $$14 = 0;
    return $$14 | 0;
   } while (0);
   L47 : do switch ($$pr428 | 0) {
   case 666:
    {
     if (!(HEAP32[$20 >> 2] | 0)) label = 124; else {
      HEAP32[$0 + 24 >> 2] = HEAP32[397];
      $$14 = -5;
      return $$14 | 0;
     }
     break;
    }
   case 42:
    {
     $80 = (HEAP32[$10 + 48 >> 2] << 12) + -30720 | 0;
     if ((HEAP32[$10 + 136 >> 2] | 0) > 1) $$0387 = 0; else {
      $85 = HEAP32[$10 + 132 >> 2] | 0;
      if (($85 | 0) < 2) $$0387 = 0; else if (($85 | 0) < 6) $$0387 = 64; else $$0387 = ($85 | 0) == 6 ? 128 : 192;
     }
     $89 = $$0387 | $80;
     $90 = $10 + 108 | 0;
     $94 = (HEAP32[$90 >> 2] | 0) == 0 ? $89 : $89 | 32;
     HEAP32[$36 >> 2] = $100 + 1;
     $101 = $10 + 8 | 0;
     HEAP8[(HEAP32[$101 >> 2] | 0) + $100 >> 0] = $94 >>> 8;
     $105 = HEAP32[$36 >> 2] | 0;
     HEAP32[$36 >> 2] = $105 + 1;
     HEAP8[(HEAP32[$101 >> 2] | 0) + $105 >> 0] = (($94 >>> 0) % 31 | 0 | $94) ^ 31;
     $$pre477 = $0 + 48 | 0;
     if (HEAP32[$90 >> 2] | 0) {
      $111 = HEAP32[$$pre477 >> 2] | 0;
      $115 = HEAP32[$36 >> 2] | 0;
      HEAP32[$36 >> 2] = $115 + 1;
      HEAP8[(HEAP32[$101 >> 2] | 0) + $115 >> 0] = $111 >>> 24;
      $120 = HEAP32[$36 >> 2] | 0;
      HEAP32[$36 >> 2] = $120 + 1;
      HEAP8[(HEAP32[$101 >> 2] | 0) + $120 >> 0] = $111 >>> 16;
      $124 = HEAP32[$$pre477 >> 2] | 0;
      $127 = HEAP32[$36 >> 2] | 0;
      HEAP32[$36 >> 2] = $127 + 1;
      HEAP8[(HEAP32[$101 >> 2] | 0) + $127 >> 0] = $124 >>> 8;
      $132 = HEAP32[$36 >> 2] | 0;
      HEAP32[$36 >> 2] = $132 + 1;
      HEAP8[(HEAP32[$101 >> 2] | 0) + $132 >> 0] = $124;
     }
     HEAP32[$$pre477 >> 2] = _adler32(0, 0, 0) | 0;
     HEAP32[$14 >> 2] = 113;
     $137 = HEAP32[$9 >> 2] | 0;
     __tr_flush_bits($137);
     $138 = $137 + 20 | 0;
     $139 = HEAP32[$138 >> 2] | 0;
     $140 = HEAP32[$29 >> 2] | 0;
     $$$i409 = $139 >>> 0 > $140 >>> 0 ? $140 : $139;
     if ($$$i409 | 0) {
      $144 = $137 + 16 | 0;
      _memcpy(HEAP32[$17 >> 2] | 0, HEAP32[$144 >> 2] | 0, $$$i409 | 0) | 0;
      HEAP32[$17 >> 2] = (HEAP32[$17 >> 2] | 0) + $$$i409;
      HEAP32[$144 >> 2] = (HEAP32[$144 >> 2] | 0) + $$$i409;
      $150 = $0 + 20 | 0;
      HEAP32[$150 >> 2] = (HEAP32[$150 >> 2] | 0) + $$$i409;
      HEAP32[$29 >> 2] = (HEAP32[$29 >> 2] | 0) - $$$i409;
      $156 = (HEAP32[$138 >> 2] | 0) - $$$i409 | 0;
      HEAP32[$138 >> 2] = $156;
      if (!$156) HEAP32[$144 >> 2] = HEAP32[$137 + 8 >> 2];
     }
     if (!(HEAP32[$36 >> 2] | 0)) {
      $162 = HEAP32[$14 >> 2] | 0;
      label = 40;
      break L47;
     }
     HEAP32[$34 >> 2] = -1;
     $$14 = 0;
     return $$14 | 0;
    }
   default:
    {
     $162 = $$pr428;
     label = 40;
    }
   } while (0);
   if ((label | 0) == 40) {
    do if (($162 | 0) == 57) {
     $165 = $0 + 48 | 0;
     HEAP32[$165 >> 2] = _crc32(0, 0, 0) | 0;
     $166 = HEAP32[$36 >> 2] | 0;
     HEAP32[$36 >> 2] = $166 + 1;
     $168 = $10 + 8 | 0;
     HEAP8[(HEAP32[$168 >> 2] | 0) + $166 >> 0] = 31;
     $171 = HEAP32[$36 >> 2] | 0;
     HEAP32[$36 >> 2] = $171 + 1;
     HEAP8[(HEAP32[$168 >> 2] | 0) + $171 >> 0] = -117;
     $175 = HEAP32[$36 >> 2] | 0;
     HEAP32[$36 >> 2] = $175 + 1;
     HEAP8[(HEAP32[$168 >> 2] | 0) + $175 >> 0] = 8;
     $179 = $10 + 28 | 0;
     $180 = HEAP32[$179 >> 2] | 0;
     if ($180 | 0) {
      $268 = ((HEAP32[$180 + 44 >> 2] | 0 ? 2 : 0) | (HEAP32[$180 >> 2] | 0) != 0 | ((HEAP32[$180 + 16 >> 2] | 0) == 0 ? 0 : 4) | ((HEAP32[$180 + 28 >> 2] | 0) == 0 ? 0 : 8) | ((HEAP32[$180 + 36 >> 2] | 0) == 0 ? 0 : 16)) & 255;
      $269 = HEAP32[$36 >> 2] | 0;
      HEAP32[$36 >> 2] = $269 + 1;
      HEAP8[(HEAP32[$168 >> 2] | 0) + $269 >> 0] = $268;
      $276 = HEAP32[(HEAP32[$179 >> 2] | 0) + 4 >> 2] & 255;
      $277 = HEAP32[$36 >> 2] | 0;
      HEAP32[$36 >> 2] = $277 + 1;
      HEAP8[(HEAP32[$168 >> 2] | 0) + $277 >> 0] = $276;
      $285 = (HEAP32[(HEAP32[$179 >> 2] | 0) + 4 >> 2] | 0) >>> 8 & 255;
      $286 = HEAP32[$36 >> 2] | 0;
      HEAP32[$36 >> 2] = $286 + 1;
      HEAP8[(HEAP32[$168 >> 2] | 0) + $286 >> 0] = $285;
      $294 = (HEAP32[(HEAP32[$179 >> 2] | 0) + 4 >> 2] | 0) >>> 16 & 255;
      $295 = HEAP32[$36 >> 2] | 0;
      HEAP32[$36 >> 2] = $295 + 1;
      HEAP8[(HEAP32[$168 >> 2] | 0) + $295 >> 0] = $294;
      $303 = (HEAP32[(HEAP32[$179 >> 2] | 0) + 4 >> 2] | 0) >>> 24 & 255;
      $304 = HEAP32[$36 >> 2] | 0;
      HEAP32[$36 >> 2] = $304 + 1;
      HEAP8[(HEAP32[$168 >> 2] | 0) + $304 >> 0] = $303;
      $309 = HEAP32[$10 + 132 >> 2] | 0;
      if (($309 | 0) == 9) $317 = 2; else $317 = (($309 | 0) < 2 ? 1 : (HEAP32[$10 + 136 >> 2] | 0) > 1) ? 4 : 0;
      $318 = HEAP32[$36 >> 2] | 0;
      HEAP32[$36 >> 2] = $318 + 1;
      HEAP8[(HEAP32[$168 >> 2] | 0) + $318 >> 0] = $317;
      $325 = HEAP32[(HEAP32[$179 >> 2] | 0) + 12 >> 2] & 255;
      $326 = HEAP32[$36 >> 2] | 0;
      HEAP32[$36 >> 2] = $326 + 1;
      HEAP8[(HEAP32[$168 >> 2] | 0) + $326 >> 0] = $325;
      $330 = HEAP32[$179 >> 2] | 0;
      if (!(HEAP32[$330 + 16 >> 2] | 0)) $351 = $330; else {
       $336 = HEAP32[$330 + 20 >> 2] & 255;
       $337 = HEAP32[$36 >> 2] | 0;
       HEAP32[$36 >> 2] = $337 + 1;
       HEAP8[(HEAP32[$168 >> 2] | 0) + $337 >> 0] = $336;
       $345 = (HEAP32[(HEAP32[$179 >> 2] | 0) + 20 >> 2] | 0) >>> 8 & 255;
       $346 = HEAP32[$36 >> 2] | 0;
       HEAP32[$36 >> 2] = $346 + 1;
       HEAP8[(HEAP32[$168 >> 2] | 0) + $346 >> 0] = $345;
       $351 = HEAP32[$179 >> 2] | 0;
      }
      if (HEAP32[$351 + 44 >> 2] | 0) HEAP32[$165 >> 2] = _crc32(HEAP32[$165 >> 2] | 0, HEAP32[$168 >> 2] | 0, HEAP32[$36 >> 2] | 0) | 0;
      HEAP32[$10 + 32 >> 2] = 0;
      HEAP32[$14 >> 2] = 69;
      $$pre$phi479Z2D = $179;
      label = 59;
      break;
     }
     $182 = HEAP32[$36 >> 2] | 0;
     HEAP32[$36 >> 2] = $182 + 1;
     HEAP8[(HEAP32[$168 >> 2] | 0) + $182 >> 0] = 0;
     $186 = HEAP32[$36 >> 2] | 0;
     HEAP32[$36 >> 2] = $186 + 1;
     HEAP8[(HEAP32[$168 >> 2] | 0) + $186 >> 0] = 0;
     $190 = HEAP32[$36 >> 2] | 0;
     HEAP32[$36 >> 2] = $190 + 1;
     HEAP8[(HEAP32[$168 >> 2] | 0) + $190 >> 0] = 0;
     $194 = HEAP32[$36 >> 2] | 0;
     HEAP32[$36 >> 2] = $194 + 1;
     HEAP8[(HEAP32[$168 >> 2] | 0) + $194 >> 0] = 0;
     $198 = HEAP32[$36 >> 2] | 0;
     HEAP32[$36 >> 2] = $198 + 1;
     HEAP8[(HEAP32[$168 >> 2] | 0) + $198 >> 0] = 0;
     $203 = HEAP32[$10 + 132 >> 2] | 0;
     if (($203 | 0) == 9) $211 = 2; else $211 = (($203 | 0) < 2 ? 1 : (HEAP32[$10 + 136 >> 2] | 0) > 1) ? 4 : 0;
     $212 = HEAP32[$36 >> 2] | 0;
     HEAP32[$36 >> 2] = $212 + 1;
     HEAP8[(HEAP32[$168 >> 2] | 0) + $212 >> 0] = $211;
     $216 = HEAP32[$36 >> 2] | 0;
     HEAP32[$36 >> 2] = $216 + 1;
     HEAP8[(HEAP32[$168 >> 2] | 0) + $216 >> 0] = 3;
     HEAP32[$14 >> 2] = 113;
     $220 = HEAP32[$9 >> 2] | 0;
     __tr_flush_bits($220);
     $221 = $220 + 20 | 0;
     $222 = HEAP32[$221 >> 2] | 0;
     $223 = HEAP32[$29 >> 2] | 0;
     $$$i411 = $222 >>> 0 > $223 >>> 0 ? $223 : $222;
     if ($$$i411 | 0) {
      $227 = $220 + 16 | 0;
      _memcpy(HEAP32[$17 >> 2] | 0, HEAP32[$227 >> 2] | 0, $$$i411 | 0) | 0;
      HEAP32[$17 >> 2] = (HEAP32[$17 >> 2] | 0) + $$$i411;
      HEAP32[$227 >> 2] = (HEAP32[$227 >> 2] | 0) + $$$i411;
      $233 = $0 + 20 | 0;
      HEAP32[$233 >> 2] = (HEAP32[$233 >> 2] | 0) + $$$i411;
      HEAP32[$29 >> 2] = (HEAP32[$29 >> 2] | 0) - $$$i411;
      $239 = (HEAP32[$221 >> 2] | 0) - $$$i411 | 0;
      HEAP32[$221 >> 2] = $239;
      if (!$239) HEAP32[$227 >> 2] = HEAP32[$220 + 8 >> 2];
     }
     if (!(HEAP32[$36 >> 2] | 0)) {
      $$pr440 = HEAP32[$14 >> 2] | 0;
      label = 57;
      break;
     }
     HEAP32[$34 >> 2] = -1;
     $$14 = 0;
     return $$14 | 0;
    } else {
     $$pr440 = $162;
     label = 57;
    } while (0);
    L95 : do if ((label | 0) == 57) switch ($$pr440 | 0) {
    case 69:
     {
      $$pre$phi479Z2D = $10 + 28 | 0;
      label = 59;
      break L95;
      break;
     }
    case 73:
     {
      $$pre$phi481Z2D = $10 + 28 | 0;
      label = 76;
      break L95;
      break;
     }
    case 91:
     {
      $$pre$phi483Z2D = $10 + 28 | 0;
      label = 93;
      break L95;
      break;
     }
    case 103:
     {
      $$pre$phi485Z2D = $10 + 28 | 0;
      label = 110;
      break L95;
      break;
     }
    default:
     break L95;
    } while (0);
    if ((label | 0) == 59) {
     $359 = HEAP32[$$pre$phi479Z2D >> 2] | 0;
     $361 = HEAP32[$359 + 16 >> 2] | 0;
     if ($361 | 0) {
      $363 = HEAP32[$36 >> 2] | 0;
      $367 = $10 + 32 | 0;
      $368 = HEAP32[$367 >> 2] | 0;
      $369 = (HEAP32[$359 + 20 >> 2] & 65535) - $368 | 0;
      $371 = $10 + 12 | 0;
      $372 = HEAP32[$371 >> 2] | 0;
      $374 = $10 + 8 | 0;
      L106 : do if (($363 + $369 | 0) >>> 0 > $372 >>> 0) {
       $375 = $0 + 48 | 0;
       $376 = $0 + 20 | 0;
       $$0388454 = $369;
       $378 = $363;
       $379 = $372;
       $383 = $361;
       $384 = $368;
       while (1) {
        $377 = $379 - $378 | 0;
        _memcpy((HEAP32[$374 >> 2] | 0) + $378 | 0, $383 + $384 | 0, $377 | 0) | 0;
        $385 = HEAP32[$371 >> 2] | 0;
        HEAP32[$36 >> 2] = $385;
        if ($385 >>> 0 > $378 >>> 0 ? (HEAP32[(HEAP32[$$pre$phi479Z2D >> 2] | 0) + 44 >> 2] | 0) != 0 : 0) HEAP32[$375 >> 2] = _crc32(HEAP32[$375 >> 2] | 0, (HEAP32[$374 >> 2] | 0) + $378 | 0, $385 - $378 | 0) | 0;
        HEAP32[$367 >> 2] = (HEAP32[$367 >> 2] | 0) + $377;
        $398 = HEAP32[$9 >> 2] | 0;
        __tr_flush_bits($398);
        $399 = $398 + 20 | 0;
        $400 = HEAP32[$399 >> 2] | 0;
        $401 = HEAP32[$29 >> 2] | 0;
        $$$i413 = $400 >>> 0 > $401 >>> 0 ? $401 : $400;
        do if ($$$i413 | 0) {
         $405 = $398 + 16 | 0;
         _memcpy(HEAP32[$17 >> 2] | 0, HEAP32[$405 >> 2] | 0, $$$i413 | 0) | 0;
         HEAP32[$17 >> 2] = (HEAP32[$17 >> 2] | 0) + $$$i413;
         HEAP32[$405 >> 2] = (HEAP32[$405 >> 2] | 0) + $$$i413;
         HEAP32[$376 >> 2] = (HEAP32[$376 >> 2] | 0) + $$$i413;
         HEAP32[$29 >> 2] = (HEAP32[$29 >> 2] | 0) - $$$i413;
         $416 = (HEAP32[$399 >> 2] | 0) - $$$i413 | 0;
         HEAP32[$399 >> 2] = $416;
         if ($416 | 0) break;
         HEAP32[$405 >> 2] = HEAP32[$398 + 8 >> 2];
        } while (0);
        if (HEAP32[$36 >> 2] | 0) break;
        $422 = $$0388454 - $377 | 0;
        $379 = HEAP32[$371 >> 2] | 0;
        $$pre462 = HEAP32[(HEAP32[$$pre$phi479Z2D >> 2] | 0) + 16 >> 2] | 0;
        $$pre463 = HEAP32[$367 >> 2] | 0;
        if ($422 >>> 0 <= $379 >>> 0) {
         $$0388$lcssa = $422;
         $$0390$lcssa = 0;
         $428 = $$pre462;
         $429 = $$pre463;
         break L106;
        } else {
         $$0388454 = $422;
         $378 = 0;
         $383 = $$pre462;
         $384 = $$pre463;
        }
       }
       HEAP32[$34 >> 2] = -1;
       $$14 = 0;
       return $$14 | 0;
      } else {
       $$0388$lcssa = $369;
       $$0390$lcssa = $363;
       $428 = $361;
       $429 = $368;
      } while (0);
      _memcpy((HEAP32[$374 >> 2] | 0) + $$0390$lcssa | 0, $428 + $429 | 0, $$0388$lcssa | 0) | 0;
      $431 = (HEAP32[$36 >> 2] | 0) + $$0388$lcssa | 0;
      HEAP32[$36 >> 2] = $431;
      if ($431 >>> 0 > $$0390$lcssa >>> 0 ? (HEAP32[(HEAP32[$$pre$phi479Z2D >> 2] | 0) + 44 >> 2] | 0) != 0 : 0) {
       $437 = $0 + 48 | 0;
       HEAP32[$437 >> 2] = _crc32(HEAP32[$437 >> 2] | 0, (HEAP32[$374 >> 2] | 0) + $$0390$lcssa | 0, $431 - $$0390$lcssa | 0) | 0;
      }
      HEAP32[$367 >> 2] = 0;
     }
     HEAP32[$14 >> 2] = 73;
     $$pre$phi481Z2D = $$pre$phi479Z2D;
     label = 76;
    }
    if ((label | 0) == 76) {
     if (HEAP32[(HEAP32[$$pre$phi481Z2D >> 2] | 0) + 28 >> 2] | 0) {
      $447 = HEAP32[$36 >> 2] | 0;
      $448 = $10 + 12 | 0;
      $449 = $0 + 48 | 0;
      $450 = $10 + 8 | 0;
      $451 = $0 + 20 | 0;
      $452 = $10 + 32 | 0;
      $$0385 = $447;
      $454 = $447;
      while (1) {
       if (($454 | 0) == (HEAP32[$448 >> 2] | 0)) {
        if ($454 >>> 0 > $$0385 >>> 0 ? (HEAP32[(HEAP32[$$pre$phi481Z2D >> 2] | 0) + 44 >> 2] | 0) != 0 : 0) HEAP32[$449 >> 2] = _crc32(HEAP32[$449 >> 2] | 0, (HEAP32[$450 >> 2] | 0) + $$0385 | 0, $454 - $$0385 | 0) | 0;
        $466 = HEAP32[$9 >> 2] | 0;
        __tr_flush_bits($466);
        $467 = $466 + 20 | 0;
        $468 = HEAP32[$467 >> 2] | 0;
        $469 = HEAP32[$29 >> 2] | 0;
        $$$i415 = $468 >>> 0 > $469 >>> 0 ? $469 : $468;
        do if ($$$i415 | 0) {
         $473 = $466 + 16 | 0;
         _memcpy(HEAP32[$17 >> 2] | 0, HEAP32[$473 >> 2] | 0, $$$i415 | 0) | 0;
         HEAP32[$17 >> 2] = (HEAP32[$17 >> 2] | 0) + $$$i415;
         HEAP32[$473 >> 2] = (HEAP32[$473 >> 2] | 0) + $$$i415;
         HEAP32[$451 >> 2] = (HEAP32[$451 >> 2] | 0) + $$$i415;
         HEAP32[$29 >> 2] = (HEAP32[$29 >> 2] | 0) - $$$i415;
         $484 = (HEAP32[$467 >> 2] | 0) - $$$i415 | 0;
         HEAP32[$467 >> 2] = $484;
         if ($484 | 0) break;
         HEAP32[$473 >> 2] = HEAP32[$466 + 8 >> 2];
        } while (0);
        if (!(HEAP32[$36 >> 2] | 0)) {
         $$1386 = 0;
         $498 = 0;
        } else {
         label = 85;
         break;
        }
       } else {
        $$1386 = $$0385;
        $498 = $454;
       }
       $490 = HEAP32[$452 >> 2] | 0;
       HEAP32[$452 >> 2] = $490 + 1;
       $496 = HEAP8[(HEAP32[(HEAP32[$$pre$phi481Z2D >> 2] | 0) + 28 >> 2] | 0) + $490 >> 0] | 0;
       HEAP32[$36 >> 2] = $498 + 1;
       HEAP8[(HEAP32[$450 >> 2] | 0) + $498 >> 0] = $496;
       if (!($496 << 24 >> 24)) break;
       $$0385 = $$1386;
       $454 = HEAP32[$36 >> 2] | 0;
      }
      if ((label | 0) == 85) {
       HEAP32[$34 >> 2] = -1;
       $$14 = 0;
       return $$14 | 0;
      }
      if (HEAP32[(HEAP32[$$pre$phi481Z2D >> 2] | 0) + 44 >> 2] | 0) {
       $506 = HEAP32[$36 >> 2] | 0;
       if ($506 >>> 0 > $$1386 >>> 0) HEAP32[$449 >> 2] = _crc32(HEAP32[$449 >> 2] | 0, (HEAP32[$450 >> 2] | 0) + $$1386 | 0, $506 - $$1386 | 0) | 0;
      }
      HEAP32[$452 >> 2] = 0;
     }
     HEAP32[$14 >> 2] = 91;
     $$pre$phi483Z2D = $$pre$phi481Z2D;
     label = 93;
    }
    if ((label | 0) == 93) {
     if (HEAP32[(HEAP32[$$pre$phi483Z2D >> 2] | 0) + 36 >> 2] | 0) {
      $517 = HEAP32[$36 >> 2] | 0;
      $518 = $10 + 12 | 0;
      $519 = $0 + 48 | 0;
      $520 = $10 + 8 | 0;
      $521 = $0 + 20 | 0;
      $522 = $10 + 32 | 0;
      $$0382 = $517;
      $524 = $517;
      while (1) {
       if (($524 | 0) == (HEAP32[$518 >> 2] | 0)) {
        if ($524 >>> 0 > $$0382 >>> 0 ? (HEAP32[(HEAP32[$$pre$phi483Z2D >> 2] | 0) + 44 >> 2] | 0) != 0 : 0) HEAP32[$519 >> 2] = _crc32(HEAP32[$519 >> 2] | 0, (HEAP32[$520 >> 2] | 0) + $$0382 | 0, $524 - $$0382 | 0) | 0;
        $536 = HEAP32[$9 >> 2] | 0;
        __tr_flush_bits($536);
        $537 = $536 + 20 | 0;
        $538 = HEAP32[$537 >> 2] | 0;
        $539 = HEAP32[$29 >> 2] | 0;
        $$$i417 = $538 >>> 0 > $539 >>> 0 ? $539 : $538;
        do if ($$$i417 | 0) {
         $543 = $536 + 16 | 0;
         _memcpy(HEAP32[$17 >> 2] | 0, HEAP32[$543 >> 2] | 0, $$$i417 | 0) | 0;
         HEAP32[$17 >> 2] = (HEAP32[$17 >> 2] | 0) + $$$i417;
         HEAP32[$543 >> 2] = (HEAP32[$543 >> 2] | 0) + $$$i417;
         HEAP32[$521 >> 2] = (HEAP32[$521 >> 2] | 0) + $$$i417;
         HEAP32[$29 >> 2] = (HEAP32[$29 >> 2] | 0) - $$$i417;
         $554 = (HEAP32[$537 >> 2] | 0) - $$$i417 | 0;
         HEAP32[$537 >> 2] = $554;
         if ($554 | 0) break;
         HEAP32[$543 >> 2] = HEAP32[$536 + 8 >> 2];
        } while (0);
        if (!(HEAP32[$36 >> 2] | 0)) {
         $$1383 = 0;
         $568 = 0;
        } else {
         label = 102;
         break;
        }
       } else {
        $$1383 = $$0382;
        $568 = $524;
       }
       $560 = HEAP32[$522 >> 2] | 0;
       HEAP32[$522 >> 2] = $560 + 1;
       $566 = HEAP8[(HEAP32[(HEAP32[$$pre$phi483Z2D >> 2] | 0) + 36 >> 2] | 0) + $560 >> 0] | 0;
       HEAP32[$36 >> 2] = $568 + 1;
       HEAP8[(HEAP32[$520 >> 2] | 0) + $568 >> 0] = $566;
       if (!($566 << 24 >> 24)) break;
       $$0382 = $$1383;
       $524 = HEAP32[$36 >> 2] | 0;
      }
      if ((label | 0) == 102) {
       HEAP32[$34 >> 2] = -1;
       $$14 = 0;
       return $$14 | 0;
      }
      if (HEAP32[(HEAP32[$$pre$phi483Z2D >> 2] | 0) + 44 >> 2] | 0) {
       $576 = HEAP32[$36 >> 2] | 0;
       if ($576 >>> 0 > $$1383 >>> 0) HEAP32[$519 >> 2] = _crc32(HEAP32[$519 >> 2] | 0, (HEAP32[$520 >> 2] | 0) + $$1383 | 0, $576 - $$1383 | 0) | 0;
      }
     }
     HEAP32[$14 >> 2] = 103;
     $$pre$phi485Z2D = $$pre$phi483Z2D;
     label = 110;
    }
    if ((label | 0) == 110) {
     if (HEAP32[(HEAP32[$$pre$phi485Z2D >> 2] | 0) + 44 >> 2] | 0) {
      $587 = HEAP32[$36 >> 2] | 0;
      do if (($587 + 2 | 0) >>> 0 > (HEAP32[$10 + 12 >> 2] | 0) >>> 0) {
       $592 = HEAP32[$9 >> 2] | 0;
       __tr_flush_bits($592);
       $593 = $592 + 20 | 0;
       $594 = HEAP32[$593 >> 2] | 0;
       $595 = HEAP32[$29 >> 2] | 0;
       $$$i419 = $594 >>> 0 > $595 >>> 0 ? $595 : $594;
       do if ($$$i419 | 0) {
        $599 = $592 + 16 | 0;
        _memcpy(HEAP32[$17 >> 2] | 0, HEAP32[$599 >> 2] | 0, $$$i419 | 0) | 0;
        HEAP32[$17 >> 2] = (HEAP32[$17 >> 2] | 0) + $$$i419;
        HEAP32[$599 >> 2] = (HEAP32[$599 >> 2] | 0) + $$$i419;
        $605 = $0 + 20 | 0;
        HEAP32[$605 >> 2] = (HEAP32[$605 >> 2] | 0) + $$$i419;
        HEAP32[$29 >> 2] = (HEAP32[$29 >> 2] | 0) - $$$i419;
        $611 = (HEAP32[$593 >> 2] | 0) - $$$i419 | 0;
        HEAP32[$593 >> 2] = $611;
        if ($611 | 0) break;
        HEAP32[$599 >> 2] = HEAP32[$592 + 8 >> 2];
       } while (0);
       if (!(HEAP32[$36 >> 2] | 0)) {
        $621 = 0;
        break;
       }
       HEAP32[$34 >> 2] = -1;
       $$14 = 0;
       return $$14 | 0;
      } else $621 = $587; while (0);
      $617 = $0 + 48 | 0;
      $619 = HEAP32[$617 >> 2] & 255;
      HEAP32[$36 >> 2] = $621 + 1;
      $622 = $10 + 8 | 0;
      HEAP8[(HEAP32[$622 >> 2] | 0) + $621 >> 0] = $619;
      $627 = (HEAP32[$617 >> 2] | 0) >>> 8 & 255;
      $628 = HEAP32[$36 >> 2] | 0;
      HEAP32[$36 >> 2] = $628 + 1;
      HEAP8[(HEAP32[$622 >> 2] | 0) + $628 >> 0] = $627;
      HEAP32[$617 >> 2] = _crc32(0, 0, 0) | 0;
     }
     HEAP32[$14 >> 2] = 113;
     $633 = HEAP32[$9 >> 2] | 0;
     __tr_flush_bits($633);
     $634 = $633 + 20 | 0;
     $635 = HEAP32[$634 >> 2] | 0;
     $636 = HEAP32[$29 >> 2] | 0;
     $$$i421 = $635 >>> 0 > $636 >>> 0 ? $636 : $635;
     if ($$$i421 | 0) {
      $640 = $633 + 16 | 0;
      _memcpy(HEAP32[$17 >> 2] | 0, HEAP32[$640 >> 2] | 0, $$$i421 | 0) | 0;
      HEAP32[$17 >> 2] = (HEAP32[$17 >> 2] | 0) + $$$i421;
      HEAP32[$640 >> 2] = (HEAP32[$640 >> 2] | 0) + $$$i421;
      $646 = $0 + 20 | 0;
      HEAP32[$646 >> 2] = (HEAP32[$646 >> 2] | 0) + $$$i421;
      HEAP32[$29 >> 2] = (HEAP32[$29 >> 2] | 0) - $$$i421;
      $652 = (HEAP32[$634 >> 2] | 0) - $$$i421 | 0;
      HEAP32[$634 >> 2] = $652;
      if (!$652) HEAP32[$640 >> 2] = HEAP32[$633 + 8 >> 2];
     }
     if (HEAP32[$36 >> 2] | 0) {
      HEAP32[$34 >> 2] = -1;
      $$14 = 0;
      return $$14 | 0;
     }
    }
    if (!(HEAP32[$20 >> 2] | 0)) label = 124; else label = 127;
   }
   if ((label | 0) == 124) if (!(HEAP32[$10 + 116 >> 2] | 0)) {
    if ($1 | 0) if ((HEAP32[$14 >> 2] | 0) != 666) label = 127;
   } else label = 127;
   do if ((label | 0) == 127) {
    $666 = HEAP32[$10 + 132 >> 2] | 0;
    L202 : do if (!$666) {
     $1067 = _deflate_stored($10, $1) | 0;
     label = 200;
    } else switch (HEAP32[$10 + 136 >> 2] | 0) {
    case 2:
     {
      $671 = $10 + 116 | 0;
      $672 = $10 + 96 | 0;
      $673 = $10 + 108 | 0;
      $674 = $10 + 56 | 0;
      $675 = $10 + 5792 | 0;
      $676 = $10 + 5796 | 0;
      $677 = $10 + 5784 | 0;
      $678 = $10 + 5788 | 0;
      $679 = $10 + 92 | 0;
      while (1) {
       if (!(HEAP32[$671 >> 2] | 0)) {
        _fill_window($10);
        if (!(HEAP32[$671 >> 2] | 0)) break;
       }
       HEAP32[$672 >> 2] = 0;
       $688 = HEAP8[(HEAP32[$674 >> 2] | 0) + (HEAP32[$673 >> 2] | 0) >> 0] | 0;
       $689 = HEAP32[$675 >> 2] | 0;
       HEAP16[(HEAP32[$676 >> 2] | 0) + ($689 << 1) >> 1] = 0;
       HEAP32[$675 >> 2] = $689 + 1;
       HEAP8[(HEAP32[$677 >> 2] | 0) + $689 >> 0] = $688;
       $696 = $10 + 148 + (($688 & 255) << 2) | 0;
       HEAP16[$696 >> 1] = (HEAP16[$696 >> 1] | 0) + 1 << 16 >> 16;
       $702 = (HEAP32[$675 >> 2] | 0) == ((HEAP32[$678 >> 2] | 0) + -1 | 0);
       HEAP32[$671 >> 2] = (HEAP32[$671 >> 2] | 0) + -1;
       $706 = (HEAP32[$673 >> 2] | 0) + 1 | 0;
       HEAP32[$673 >> 2] = $706;
       if (!$702) continue;
       $707 = HEAP32[$679 >> 2] | 0;
       if (($707 | 0) > -1) $712 = (HEAP32[$674 >> 2] | 0) + $707 | 0; else $712 = 0;
       __tr_flush_block($10, $712, $706 - $707 | 0, 0);
       HEAP32[$679 >> 2] = HEAP32[$673 >> 2];
       $714 = HEAP32[$10 >> 2] | 0;
       $716 = HEAP32[$714 + 28 >> 2] | 0;
       __tr_flush_bits($716);
       $717 = $716 + 20 | 0;
       $718 = HEAP32[$717 >> 2] | 0;
       $719 = $714 + 16 | 0;
       $720 = HEAP32[$719 >> 2] | 0;
       $$$i$i424 = $718 >>> 0 > $720 >>> 0 ? $720 : $718;
       do if ($$$i$i424 | 0) {
        $723 = $714 + 12 | 0;
        $725 = $716 + 16 | 0;
        _memcpy(HEAP32[$723 >> 2] | 0, HEAP32[$725 >> 2] | 0, $$$i$i424 | 0) | 0;
        HEAP32[$723 >> 2] = (HEAP32[$723 >> 2] | 0) + $$$i$i424;
        HEAP32[$725 >> 2] = (HEAP32[$725 >> 2] | 0) + $$$i$i424;
        $731 = $714 + 20 | 0;
        HEAP32[$731 >> 2] = (HEAP32[$731 >> 2] | 0) + $$$i$i424;
        HEAP32[$719 >> 2] = (HEAP32[$719 >> 2] | 0) - $$$i$i424;
        $737 = (HEAP32[$717 >> 2] | 0) - $$$i$i424 | 0;
        HEAP32[$717 >> 2] = $737;
        if ($737 | 0) break;
        HEAP32[$725 >> 2] = HEAP32[$716 + 8 >> 2];
       } while (0);
       if (!(HEAP32[(HEAP32[$10 >> 2] | 0) + 16 >> 2] | 0)) {
        label = 203;
        break L202;
       }
      }
      if (!$1) {
       label = 203;
       break L202;
      }
      HEAP32[$10 + 5812 >> 2] = 0;
      if (($1 | 0) == 4) {
       $747 = HEAP32[$679 >> 2] | 0;
       if (($747 | 0) > -1) $753 = (HEAP32[$674 >> 2] | 0) + $747 | 0; else $753 = 0;
       __tr_flush_block($10, $753, (HEAP32[$673 >> 2] | 0) - $747 | 0, 1);
       HEAP32[$679 >> 2] = HEAP32[$673 >> 2];
       $755 = HEAP32[$10 >> 2] | 0;
       $757 = HEAP32[$755 + 28 >> 2] | 0;
       __tr_flush_bits($757);
       $758 = $757 + 20 | 0;
       $759 = HEAP32[$758 >> 2] | 0;
       $760 = $755 + 16 | 0;
       $761 = HEAP32[$760 >> 2] | 0;
       $$$i52$i = $759 >>> 0 > $761 >>> 0 ? $761 : $759;
       do if ($$$i52$i | 0) {
        $764 = $755 + 12 | 0;
        $766 = $757 + 16 | 0;
        _memcpy(HEAP32[$764 >> 2] | 0, HEAP32[$766 >> 2] | 0, $$$i52$i | 0) | 0;
        HEAP32[$764 >> 2] = (HEAP32[$764 >> 2] | 0) + $$$i52$i;
        HEAP32[$766 >> 2] = (HEAP32[$766 >> 2] | 0) + $$$i52$i;
        $772 = $755 + 20 | 0;
        HEAP32[$772 >> 2] = (HEAP32[$772 >> 2] | 0) + $$$i52$i;
        HEAP32[$760 >> 2] = (HEAP32[$760 >> 2] | 0) - $$$i52$i;
        $778 = (HEAP32[$758 >> 2] | 0) - $$$i52$i | 0;
        HEAP32[$758 >> 2] = $778;
        if ($778 | 0) break;
        HEAP32[$766 >> 2] = HEAP32[$757 + 8 >> 2];
       } while (0);
       $1067 = (HEAP32[(HEAP32[$10 >> 2] | 0) + 16 >> 2] | 0) == 0 ? 2 : 3;
       label = 200;
       break L202;
      }
      if (!(HEAP32[$675 >> 2] | 0)) break L202;
      $788 = HEAP32[$679 >> 2] | 0;
      if (($788 | 0) > -1) $794 = (HEAP32[$674 >> 2] | 0) + $788 | 0; else $794 = 0;
      __tr_flush_block($10, $794, (HEAP32[$673 >> 2] | 0) - $788 | 0, 0);
      HEAP32[$679 >> 2] = HEAP32[$673 >> 2];
      $796 = HEAP32[$10 >> 2] | 0;
      $798 = HEAP32[$796 + 28 >> 2] | 0;
      __tr_flush_bits($798);
      $799 = $798 + 20 | 0;
      $800 = HEAP32[$799 >> 2] | 0;
      $801 = $796 + 16 | 0;
      $802 = HEAP32[$801 >> 2] | 0;
      $$$i54$i = $800 >>> 0 > $802 >>> 0 ? $802 : $800;
      do if ($$$i54$i | 0) {
       $805 = $796 + 12 | 0;
       $807 = $798 + 16 | 0;
       _memcpy(HEAP32[$805 >> 2] | 0, HEAP32[$807 >> 2] | 0, $$$i54$i | 0) | 0;
       HEAP32[$805 >> 2] = (HEAP32[$805 >> 2] | 0) + $$$i54$i;
       HEAP32[$807 >> 2] = (HEAP32[$807 >> 2] | 0) + $$$i54$i;
       $813 = $796 + 20 | 0;
       HEAP32[$813 >> 2] = (HEAP32[$813 >> 2] | 0) + $$$i54$i;
       HEAP32[$801 >> 2] = (HEAP32[$801 >> 2] | 0) - $$$i54$i;
       $819 = (HEAP32[$799 >> 2] | 0) - $$$i54$i | 0;
       HEAP32[$799 >> 2] = $819;
       if ($819 | 0) break;
       HEAP32[$807 >> 2] = HEAP32[$798 + 8 >> 2];
      } while (0);
      if (!(HEAP32[(HEAP32[$10 >> 2] | 0) + 16 >> 2] | 0)) {
       label = 203;
       break L202;
      } else break L202;
      break;
     }
    case 3:
     {
      $827 = $10 + 116 | 0;
      $828 = ($1 | 0) == 0;
      $829 = $10 + 96 | 0;
      $830 = $10 + 108 | 0;
      $831 = $10 + 5792 | 0;
      $832 = $10 + 5796 | 0;
      $833 = $10 + 5784 | 0;
      $834 = $10 + 5788 | 0;
      $835 = $10 + 56 | 0;
      $836 = $10 + 92 | 0;
      L242 : while (1) {
       $837 = HEAP32[$827 >> 2] | 0;
       do if ($837 >>> 0 < 259) {
        _fill_window($10);
        $839 = HEAP32[$827 >> 2] | 0;
        if ($828 & $839 >>> 0 < 259) {
         label = 203;
         break L202;
        }
        if (!$839) break L242;
        HEAP32[$829 >> 2] = 0;
        if ($839 >>> 0 > 2) {
         $884 = $839;
         label = 162;
         break;
        }
        $920 = HEAP32[$830 >> 2] | 0;
        label = 177;
       } else {
        HEAP32[$829 >> 2] = 0;
        $884 = $837;
        label = 162;
       } while (0);
       do if ((label | 0) == 162) {
        label = 0;
        $843 = HEAP32[$830 >> 2] | 0;
        if (!$843) {
         $920 = 0;
         label = 177;
        } else {
         $846 = (HEAP32[$835 >> 2] | 0) + $843 | 0;
         $847 = HEAP8[$846 + -1 >> 0] | 0;
         if ($847 << 24 >> 24 != (HEAP8[$846 >> 0] | 0)) {
          $920 = $843;
          label = 177;
          break;
         }
         $$ptr135$i = $846 + 1 | 0;
         if ($847 << 24 >> 24 != (HEAP8[$$ptr135$i >> 0] | 0)) {
          $920 = $843;
          label = 177;
          break;
         }
         if ($847 << 24 >> 24 != (HEAP8[$$ptr135$i + 1 >> 0] | 0)) {
          $920 = $843;
          label = 177;
          break;
         }
         $855 = $846 + 258 | 0;
         $$idx$i = 1;
         while (1) {
          $$ptr$i = $846 + $$idx$i | 0;
          $856 = $$ptr$i + 2 | 0;
          if ($847 << 24 >> 24 != (HEAP8[$856 >> 0] | 0)) {
           $$1$i = $856;
           break;
          }
          $859 = $$ptr$i + 3 | 0;
          if ($847 << 24 >> 24 != (HEAP8[$859 >> 0] | 0)) {
           $$1$i = $859;
           break;
          }
          $862 = $$ptr$i + 4 | 0;
          if ($847 << 24 >> 24 != (HEAP8[$862 >> 0] | 0)) {
           $$1$i = $862;
           break;
          }
          $865 = $$ptr$i + 5 | 0;
          if ($847 << 24 >> 24 != (HEAP8[$865 >> 0] | 0)) {
           $$1$i = $865;
           break;
          }
          $868 = $$ptr$i + 6 | 0;
          if ($847 << 24 >> 24 != (HEAP8[$868 >> 0] | 0)) {
           $$1$i = $868;
           break;
          }
          $871 = $$ptr$i + 7 | 0;
          if ($847 << 24 >> 24 != (HEAP8[$871 >> 0] | 0)) {
           $$1$i = $871;
           break;
          }
          $$idx$i$looptemp = $$idx$i;
          $$idx$i = $$idx$i + 8 | 0;
          $$ptr132$i = $846 + $$idx$i | 0;
          if ($847 << 24 >> 24 != (HEAP8[$$ptr132$i >> 0] | 0)) {
           $$1$i = $$ptr132$i;
           break;
          }
          $$add$i = $$idx$i$looptemp + 9 | 0;
          $$ptr131$i = $846 + $$add$i | 0;
          if (!(($$add$i | 0) < 258 ? $847 << 24 >> 24 == (HEAP8[$$ptr131$i >> 0] | 0) : 0)) {
           $$1$i = $$ptr131$i;
           break;
          }
         }
         $882 = $$1$i - $855 + 258 | 0;
         $$$i407 = $882 >>> 0 > $884 >>> 0 ? $884 : $882;
         HEAP32[$829 >> 2] = $$$i407;
         if ($$$i407 >>> 0 <= 2) {
          $920 = $843;
          label = 177;
          break;
         }
         $886 = $$$i407 + 253 | 0;
         $888 = HEAP32[$831 >> 2] | 0;
         HEAP16[(HEAP32[$832 >> 2] | 0) + ($888 << 1) >> 1] = 1;
         HEAP32[$831 >> 2] = $888 + 1;
         HEAP8[(HEAP32[$833 >> 2] | 0) + $888 >> 0] = $886;
         $900 = $10 + 148 + ((HEAPU8[13012 + ($886 & 255) >> 0] | 256) + 1 << 2) | 0;
         HEAP16[$900 >> 1] = (HEAP16[$900 >> 1] | 0) + 1 << 16 >> 16;
         $905 = $10 + 2440 + (HEAPU8[12500] << 2) | 0;
         HEAP16[$905 >> 1] = (HEAP16[$905 >> 1] | 0) + 1 << 16 >> 16;
         $912 = (HEAP32[$831 >> 2] | 0) == ((HEAP32[$834 >> 2] | 0) + -1 | 0) & 1;
         $913 = HEAP32[$829 >> 2] | 0;
         HEAP32[$827 >> 2] = (HEAP32[$827 >> 2] | 0) - $913;
         $917 = (HEAP32[$830 >> 2] | 0) + $913 | 0;
         HEAP32[$830 >> 2] = $917;
         HEAP32[$829 >> 2] = 0;
         $$0128$i = $912;
         $947 = $917;
        }
       } while (0);
       if ((label | 0) == 177) {
        label = 0;
        $921 = HEAP8[(HEAP32[$835 >> 2] | 0) + $920 >> 0] | 0;
        $922 = HEAP32[$831 >> 2] | 0;
        HEAP16[(HEAP32[$832 >> 2] | 0) + ($922 << 1) >> 1] = 0;
        HEAP32[$831 >> 2] = $922 + 1;
        HEAP8[(HEAP32[$833 >> 2] | 0) + $922 >> 0] = $921;
        $929 = $10 + 148 + (($921 & 255) << 2) | 0;
        HEAP16[$929 >> 1] = (HEAP16[$929 >> 1] | 0) + 1 << 16 >> 16;
        $936 = (HEAP32[$831 >> 2] | 0) == ((HEAP32[$834 >> 2] | 0) + -1 | 0) & 1;
        HEAP32[$827 >> 2] = (HEAP32[$827 >> 2] | 0) + -1;
        $940 = (HEAP32[$830 >> 2] | 0) + 1 | 0;
        HEAP32[$830 >> 2] = $940;
        $$0128$i = $936;
        $947 = $940;
       }
       if (!$$0128$i) continue;
       $942 = HEAP32[$836 >> 2] | 0;
       if (($942 | 0) > -1) $948 = (HEAP32[$835 >> 2] | 0) + $942 | 0; else $948 = 0;
       __tr_flush_block($10, $948, $947 - $942 | 0, 0);
       HEAP32[$836 >> 2] = HEAP32[$830 >> 2];
       $950 = HEAP32[$10 >> 2] | 0;
       $952 = HEAP32[$950 + 28 >> 2] | 0;
       __tr_flush_bits($952);
       $953 = $952 + 20 | 0;
       $954 = HEAP32[$953 >> 2] | 0;
       $955 = $950 + 16 | 0;
       $956 = HEAP32[$955 >> 2] | 0;
       $$$i$i = $954 >>> 0 > $956 >>> 0 ? $956 : $954;
       do if ($$$i$i | 0) {
        $959 = $950 + 12 | 0;
        $961 = $952 + 16 | 0;
        _memcpy(HEAP32[$959 >> 2] | 0, HEAP32[$961 >> 2] | 0, $$$i$i | 0) | 0;
        HEAP32[$959 >> 2] = (HEAP32[$959 >> 2] | 0) + $$$i$i;
        HEAP32[$961 >> 2] = (HEAP32[$961 >> 2] | 0) + $$$i$i;
        $967 = $950 + 20 | 0;
        HEAP32[$967 >> 2] = (HEAP32[$967 >> 2] | 0) + $$$i$i;
        HEAP32[$955 >> 2] = (HEAP32[$955 >> 2] | 0) - $$$i$i;
        $973 = (HEAP32[$953 >> 2] | 0) - $$$i$i | 0;
        HEAP32[$953 >> 2] = $973;
        if ($973 | 0) break;
        HEAP32[$961 >> 2] = HEAP32[$952 + 8 >> 2];
       } while (0);
       if (!(HEAP32[(HEAP32[$10 >> 2] | 0) + 16 >> 2] | 0)) {
        label = 203;
        break L202;
       }
      }
      HEAP32[$10 + 5812 >> 2] = 0;
      if (($1 | 0) == 4) {
       $983 = HEAP32[$836 >> 2] | 0;
       if (($983 | 0) > -1) $989 = (HEAP32[$835 >> 2] | 0) + $983 | 0; else $989 = 0;
       __tr_flush_block($10, $989, (HEAP32[$830 >> 2] | 0) - $983 | 0, 1);
       HEAP32[$836 >> 2] = HEAP32[$830 >> 2];
       $991 = HEAP32[$10 >> 2] | 0;
       $993 = HEAP32[$991 + 28 >> 2] | 0;
       __tr_flush_bits($993);
       $994 = $993 + 20 | 0;
       $995 = HEAP32[$994 >> 2] | 0;
       $996 = $991 + 16 | 0;
       $997 = HEAP32[$996 >> 2] | 0;
       $$$i138$i = $995 >>> 0 > $997 >>> 0 ? $997 : $995;
       do if ($$$i138$i | 0) {
        $1000 = $991 + 12 | 0;
        $1002 = $993 + 16 | 0;
        _memcpy(HEAP32[$1000 >> 2] | 0, HEAP32[$1002 >> 2] | 0, $$$i138$i | 0) | 0;
        HEAP32[$1000 >> 2] = (HEAP32[$1000 >> 2] | 0) + $$$i138$i;
        HEAP32[$1002 >> 2] = (HEAP32[$1002 >> 2] | 0) + $$$i138$i;
        $1008 = $991 + 20 | 0;
        HEAP32[$1008 >> 2] = (HEAP32[$1008 >> 2] | 0) + $$$i138$i;
        HEAP32[$996 >> 2] = (HEAP32[$996 >> 2] | 0) - $$$i138$i;
        $1014 = (HEAP32[$994 >> 2] | 0) - $$$i138$i | 0;
        HEAP32[$994 >> 2] = $1014;
        if ($1014 | 0) break;
        HEAP32[$1002 >> 2] = HEAP32[$993 + 8 >> 2];
       } while (0);
       $1067 = (HEAP32[(HEAP32[$10 >> 2] | 0) + 16 >> 2] | 0) == 0 ? 2 : 3;
       label = 200;
       break L202;
      }
      if (!(HEAP32[$831 >> 2] | 0)) break L202;
      $1024 = HEAP32[$836 >> 2] | 0;
      if (($1024 | 0) > -1) $1030 = (HEAP32[$835 >> 2] | 0) + $1024 | 0; else $1030 = 0;
      __tr_flush_block($10, $1030, (HEAP32[$830 >> 2] | 0) - $1024 | 0, 0);
      HEAP32[$836 >> 2] = HEAP32[$830 >> 2];
      $1032 = HEAP32[$10 >> 2] | 0;
      $1034 = HEAP32[$1032 + 28 >> 2] | 0;
      __tr_flush_bits($1034);
      $1035 = $1034 + 20 | 0;
      $1036 = HEAP32[$1035 >> 2] | 0;
      $1037 = $1032 + 16 | 0;
      $1038 = HEAP32[$1037 >> 2] | 0;
      $$$i140$i = $1036 >>> 0 > $1038 >>> 0 ? $1038 : $1036;
      do if ($$$i140$i | 0) {
       $1041 = $1032 + 12 | 0;
       $1043 = $1034 + 16 | 0;
       _memcpy(HEAP32[$1041 >> 2] | 0, HEAP32[$1043 >> 2] | 0, $$$i140$i | 0) | 0;
       HEAP32[$1041 >> 2] = (HEAP32[$1041 >> 2] | 0) + $$$i140$i;
       HEAP32[$1043 >> 2] = (HEAP32[$1043 >> 2] | 0) + $$$i140$i;
       $1049 = $1032 + 20 | 0;
       HEAP32[$1049 >> 2] = (HEAP32[$1049 >> 2] | 0) + $$$i140$i;
       HEAP32[$1037 >> 2] = (HEAP32[$1037 >> 2] | 0) - $$$i140$i;
       $1055 = (HEAP32[$1035 >> 2] | 0) - $$$i140$i | 0;
       HEAP32[$1035 >> 2] = $1055;
       if ($1055 | 0) break;
       HEAP32[$1043 >> 2] = HEAP32[$1034 + 8 >> 2];
      } while (0);
      if (!(HEAP32[(HEAP32[$10 >> 2] | 0) + 16 >> 2] | 0)) {
       label = 203;
       break L202;
      } else break L202;
      break;
     }
    default:
     {
      $1067 = FUNCTION_TABLE_iii[HEAP32[832 + ($666 * 12 | 0) + 8 >> 2] & 15]($10, $1) | 0;
      label = 200;
      break L202;
     }
    } while (0);
    if ((label | 0) == 200) {
     if (($1067 | 1 | 0) == 3) HEAP32[$14 >> 2] = 666;
     if (($1067 | 2 | 0) == 2) label = 203; else if (($1067 | 0) != 1) break;
    }
    if ((label | 0) == 203) {
     if (HEAP32[$29 >> 2] | 0) {
      $$14 = 0;
      return $$14 | 0;
     }
     HEAP32[$34 >> 2] = -1;
     $$14 = 0;
     return $$14 | 0;
    }
    switch ($1 | 0) {
    case 1:
     {
      __tr_align($10);
      break;
     }
    case 5:
     break;
    default:
     {
      __tr_stored_block($10, 0, 0, 0);
      if (($1 | 0) == 3) {
       $1076 = HEAP32[$10 + 76 >> 2] | 0;
       $1079 = HEAP32[$10 + 68 >> 2] | 0;
       HEAP16[$1079 + ($1076 + -1 << 1) >> 1] = 0;
       _memset($1079 | 0, 0, ($1076 << 1) + -2 | 0) | 0;
       if (!(HEAP32[$10 + 116 >> 2] | 0)) {
        HEAP32[$10 + 108 >> 2] = 0;
        HEAP32[$10 + 92 >> 2] = 0;
        HEAP32[$10 + 5812 >> 2] = 0;
       }
      }
     }
    }
    $1089 = HEAP32[$9 >> 2] | 0;
    __tr_flush_bits($1089);
    $1090 = $1089 + 20 | 0;
    $1091 = HEAP32[$1090 >> 2] | 0;
    $1092 = HEAP32[$29 >> 2] | 0;
    $$$i405 = $1091 >>> 0 > $1092 >>> 0 ? $1092 : $1091;
    if (!$$$i405) $1112 = $1092; else {
     $1096 = $1089 + 16 | 0;
     _memcpy(HEAP32[$17 >> 2] | 0, HEAP32[$1096 >> 2] | 0, $$$i405 | 0) | 0;
     HEAP32[$17 >> 2] = (HEAP32[$17 >> 2] | 0) + $$$i405;
     HEAP32[$1096 >> 2] = (HEAP32[$1096 >> 2] | 0) + $$$i405;
     $1102 = $0 + 20 | 0;
     HEAP32[$1102 >> 2] = (HEAP32[$1102 >> 2] | 0) + $$$i405;
     $1106 = (HEAP32[$29 >> 2] | 0) - $$$i405 | 0;
     HEAP32[$29 >> 2] = $1106;
     $1108 = (HEAP32[$1090 >> 2] | 0) - $$$i405 | 0;
     HEAP32[$1090 >> 2] = $1108;
     if (!$1108) {
      HEAP32[$1096 >> 2] = HEAP32[$1089 + 8 >> 2];
      $1112 = $1106;
     } else $1112 = $1106;
    }
    if (!$1112) {
     HEAP32[$34 >> 2] = -1;
     $$14 = 0;
     return $$14 | 0;
    }
   } while (0);
   if ($26) {
    $$14 = 0;
    return $$14 | 0;
   }
   $1114 = $10 + 24 | 0;
   $1115 = HEAP32[$1114 >> 2] | 0;
   if (($1115 | 0) < 1) {
    $$14 = 1;
    return $$14 | 0;
   }
   $1118 = $0 + 48 | 0;
   $1119 = HEAP32[$1118 >> 2] | 0;
   if (($1115 | 0) == 2) {
    $1121 = HEAP32[$36 >> 2] | 0;
    HEAP32[$36 >> 2] = $1121 + 1;
    $1123 = $10 + 8 | 0;
    HEAP8[(HEAP32[$1123 >> 2] | 0) + $1121 >> 0] = $1119;
    $1128 = (HEAP32[$1118 >> 2] | 0) >>> 8 & 255;
    $1129 = HEAP32[$36 >> 2] | 0;
    HEAP32[$36 >> 2] = $1129 + 1;
    HEAP8[(HEAP32[$1123 >> 2] | 0) + $1129 >> 0] = $1128;
    $1135 = (HEAP32[$1118 >> 2] | 0) >>> 16 & 255;
    $1136 = HEAP32[$36 >> 2] | 0;
    HEAP32[$36 >> 2] = $1136 + 1;
    HEAP8[(HEAP32[$1123 >> 2] | 0) + $1136 >> 0] = $1135;
    $1142 = (HEAP32[$1118 >> 2] | 0) >>> 24 & 255;
    $1143 = HEAP32[$36 >> 2] | 0;
    HEAP32[$36 >> 2] = $1143 + 1;
    HEAP8[(HEAP32[$1123 >> 2] | 0) + $1143 >> 0] = $1142;
    $1147 = $0 + 8 | 0;
    $1149 = HEAP32[$1147 >> 2] & 255;
    $1150 = HEAP32[$36 >> 2] | 0;
    HEAP32[$36 >> 2] = $1150 + 1;
    HEAP8[(HEAP32[$1123 >> 2] | 0) + $1150 >> 0] = $1149;
    $1156 = (HEAP32[$1147 >> 2] | 0) >>> 8 & 255;
    $1157 = HEAP32[$36 >> 2] | 0;
    HEAP32[$36 >> 2] = $1157 + 1;
    HEAP8[(HEAP32[$1123 >> 2] | 0) + $1157 >> 0] = $1156;
    $1163 = (HEAP32[$1147 >> 2] | 0) >>> 16 & 255;
    $1164 = HEAP32[$36 >> 2] | 0;
    HEAP32[$36 >> 2] = $1164 + 1;
    HEAP8[(HEAP32[$1123 >> 2] | 0) + $1164 >> 0] = $1163;
    $1170 = (HEAP32[$1147 >> 2] | 0) >>> 24 & 255;
    $1171 = HEAP32[$36 >> 2] | 0;
    HEAP32[$36 >> 2] = $1171 + 1;
    HEAP8[(HEAP32[$1123 >> 2] | 0) + $1171 >> 0] = $1170;
   } else {
    $1178 = HEAP32[$36 >> 2] | 0;
    HEAP32[$36 >> 2] = $1178 + 1;
    $1180 = $10 + 8 | 0;
    HEAP8[(HEAP32[$1180 >> 2] | 0) + $1178 >> 0] = $1119 >>> 24;
    $1184 = HEAP32[$36 >> 2] | 0;
    HEAP32[$36 >> 2] = $1184 + 1;
    HEAP8[(HEAP32[$1180 >> 2] | 0) + $1184 >> 0] = $1119 >>> 16;
    $1188 = HEAP32[$1118 >> 2] | 0;
    $1191 = HEAP32[$36 >> 2] | 0;
    HEAP32[$36 >> 2] = $1191 + 1;
    HEAP8[(HEAP32[$1180 >> 2] | 0) + $1191 >> 0] = $1188 >>> 8;
    $1196 = HEAP32[$36 >> 2] | 0;
    HEAP32[$36 >> 2] = $1196 + 1;
    HEAP8[(HEAP32[$1180 >> 2] | 0) + $1196 >> 0] = $1188;
   }
   $1200 = HEAP32[$9 >> 2] | 0;
   __tr_flush_bits($1200);
   $1201 = $1200 + 20 | 0;
   $1202 = HEAP32[$1201 >> 2] | 0;
   $1203 = HEAP32[$29 >> 2] | 0;
   $$$i = $1202 >>> 0 > $1203 >>> 0 ? $1203 : $1202;
   if ($$$i | 0) {
    $1207 = $1200 + 16 | 0;
    _memcpy(HEAP32[$17 >> 2] | 0, HEAP32[$1207 >> 2] | 0, $$$i | 0) | 0;
    HEAP32[$17 >> 2] = (HEAP32[$17 >> 2] | 0) + $$$i;
    HEAP32[$1207 >> 2] = (HEAP32[$1207 >> 2] | 0) + $$$i;
    $1213 = $0 + 20 | 0;
    HEAP32[$1213 >> 2] = (HEAP32[$1213 >> 2] | 0) + $$$i;
    HEAP32[$29 >> 2] = (HEAP32[$29 >> 2] | 0) - $$$i;
    $1219 = (HEAP32[$1201 >> 2] | 0) - $$$i | 0;
    HEAP32[$1201 >> 2] = $1219;
    if (!$1219) HEAP32[$1207 >> 2] = HEAP32[$1200 + 8 >> 2];
   }
   $1223 = HEAP32[$1114 >> 2] | 0;
   if (($1223 | 0) > 0) HEAP32[$1114 >> 2] = 0 - $1223;
   $$14 = (HEAP32[$36 >> 2] | 0) == 0 & 1;
   return $$14 | 0;
  }
 } while (0);
 HEAP32[$0 + 24 >> 2] = HEAP32[394];
 $$14 = -2;
 return $$14 | 0;
}

function _printf_core($0, $1, $2, $3, $4) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 var $$$3484$i = 0, $$$3484705$i = 0, $$$4266 = 0, $$$4502$i = 0, $$$5 = 0, $$0 = 0, $$0$i = 0, $$0$lcssa$i300 = 0, $$0228 = 0, $$0229396 = 0, $$0232 = 0, $$0235 = 0, $$0237 = 0, $$0240$lcssa = 0, $$0240$lcssa460 = 0, $$0240395 = 0, $$0243 = 0, $$0247 = 0, $$0249$lcssa = 0, $$0249383 = 0, $$0252 = 0, $$0253 = 0, $$0254 = 0, $$0259 = 0, $$0262342 = 0, $$0262390 = 0, $$0269 = 0, $$0321 = 0, $$0463$lcssa$i = 0, $$0463593$i = 0, $$0464602$i = 0, $$0466$i = 0.0, $$0470$i = 0, $$0471$i = 0.0, $$0479$i = 0, $$0487651$i = 0, $$0488662$i = 0, $$0488664$i = 0, $$0496$$9$i = 0, $$0497663$i = 0, $$0498$i = 0, $$05$lcssa$i = 0, $$0509591$i = 0.0, $$0511$i = 0, $$0514646$i = 0, $$0520$i = 0, $$0521$$i = 0, $$0521$i = 0, $$0523$i = 0, $$0525$i = 0, $$0527638$i = 0, $$0527640$i = 0, $$0530645$i = 0, $$056$i = 0, $$06$i = 0, $$06$i290 = 0, $$06$i298 = 0, $$1 = 0, $$1230407 = 0, $$1233 = 0, $$1236 = 0, $$1238 = 0, $$1241406 = 0, $$1244394 = 0, $$1248 = 0, $$1255 = 0, $$1260 = 0, $$1263 = 0, $$1263$ = 0, $$1270 = 0, $$1322 = 0, $$1465$i = 0, $$1467$i = 0.0, $$1469$i = 0.0, $$1472$i = 0.0, $$1480$i = 0, $$1482$lcssa$i = 0, $$1482670$i = 0, $$1489650$i = 0, $$1499$lcssa$i = 0, $$1499669$i = 0, $$1508592$i = 0, $$1512$lcssa$i = 0, $$1512616$i = 0, $$1515$i = 0, $$1524$i = 0, $$1528623$i = 0, $$1531$lcssa$i = 0, $$1531639$i = 0, $$1606$i = 0, $$2 = 0, $$2$i = 0, $$2234 = 0, $$2239 = 0, $$2242381 = 0, $$2245 = 0, $$2251 = 0, $$2256 = 0, $$2261 = 0, $$2271 = 0, $$2323$lcssa = 0, $$2323382 = 0, $$2473$i = 0.0, $$2476$i = 0, $$2483$ph$i = 0, $$2490$lcssa$i = 0, $$2490631$i = 0, $$2500$i = 0, $$2513$i = 0, $$2516627$i = 0, $$2529$i = 0, $$2532626$i = 0, $$3$i = 0.0, $$3265 = 0, $$3272 = 0, $$331 = 0, $$3379 = 0, $$3477$i = 0, $$3484$lcssa$i = 0, $$3484657$i = 0, $$3501$lcssa$i = 0, $$3501656$i = 0, $$3533622$i = 0, $$4$i = 0.0, $$4258458 = 0, $$4266 = 0, $$4325 = 0, $$4478$lcssa$i = 0, $$4478599$i = 0, $$4492$i = 0, $$4502$i = 0, $$4518$i = 0, $$5 = 0, $$5$lcssa$i = 0, $$537$$i = 0, $$537$i = 0, $$540$i = 0.0, $$543$i = 0, $$545$i = 0, $$5486$lcssa$i = 0, $$5486632$i = 0, $$5493605$i = 0, $$5519$ph$i = 0, $$553$i = 0, $$5610$i = 0, $$6 = 0, $$6$i = 0, $$6268 = 0, $$6494598$i = 0, $$7 = 0, $$7495609$i = 0, $$7505$$i = 0, $$7505$i = 0, $$7505$ph$i = 0, $$8$i = 0, $$9$ph$i = 0, $$lcssa682$i = 0, $$pn$i = 0, $$pr = 0, $$pr$i = 0, $$pr570$i = 0, $$pre$phi703$iZ2D = 0, $$pre454 = 0, $$pre699$i = 0, $10 = 0, $104 = 0, $105 = 0, $106 = 0, $11 = 0, $113 = 0, $114 = 0, $118 = 0, $119 = 0, $12 = 0, $121 = 0, $13 = 0, $14 = 0, $145 = 0, $146 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $156 = 0, $158 = 0, $16 = 0, $160 = 0, $161 = 0, $166 = 0, $169 = 0, $17 = 0, $174 = 0, $175 = 0, $18 = 0, $180 = 0, $187 = 0, $188 = 0, $19 = 0, $199 = 0, $20 = 0, $21 = 0, $211 = 0, $218 = 0, $22 = 0, $220 = 0, $223 = 0, $224 = 0, $229 = 0, $23 = 0, $236 = 0, $24 = 0, $242 = 0, $248 = 0, $25 = 0, $250 = 0, $257 = 0, $259 = 0, $26 = 0, $262 = 0, $267 = 0, $27 = 0, $270 = 0, $271 = 0, $28 = 0, $280 = 0, $283 = 0, $285 = 0, $288 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $298 = 0, $300 = 0, $301 = 0, $305 = 0, $313 = 0, $319 = 0, $331 = 0, $334 = 0, $335 = 0, $347 = 0, $349 = 0, $35 = 0, $354 = 0, $358 = 0, $361 = 0, $37 = 0, $371 = 0.0, $378 = 0, $38 = 0, $382 = 0, $389 = 0, $393 = 0, $394 = 0, $398 = 0, $404 = 0.0, $405 = 0, $408 = 0, $410 = 0, $413 = 0, $415 = 0, $42 = 0, $429 = 0, $43 = 0, $432 = 0, $435 = 0, $444 = 0, $446 = 0, $447 = 0, $453 = 0, $465 = 0, $470 = 0, $475 = 0, $479 = 0, $48 = 0, $489 = 0, $491 = 0, $498 = 0, $5 = 0, $500 = 0, $503 = 0, $505 = 0, $506 = 0, $507 = 0, $513 = 0, $515 = 0, $519 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $529 = 0, $53 = 0, $535 = 0, $536 = 0, $537 = 0, $54 = 0, $549 = 0, $560 = 0, $564 = 0, $565 = 0, $568 = 0, $573 = 0, $574 = 0, $576 = 0, $58 = 0, $584 = 0, $587 = 0, $590 = 0, $591 = 0, $592 = 0, $595 = 0, $599 = 0, $6 = 0, $607 = 0, $61 = 0, $610 = 0, $612 = 0, $614 = 0, $616 = 0, $62 = 0, $621 = 0, $622 = 0, $625 = 0, $627 = 0, $629 = 0, $631 = 0, $642 = 0, $645 = 0, $65 = 0, $650 = 0, $659 = 0, $660 = 0, $664 = 0, $667 = 0, $669 = 0, $671 = 0, $675 = 0, $678 = 0, $682 = 0, $69 = 0, $692 = 0, $697 = 0, $7 = 0, $704 = 0, $709 = 0, $72 = 0, $727 = 0, $73 = 0, $731 = 0, $739 = 0, $74 = 0, $746 = 0, $748 = 0, $752 = 0, $754 = 0, $763 = 0, $769 = 0, $78 = 0, $784 = 0, $786 = 0, $799 = 0, $8 = 0, $80 = 0, $809 = 0, $81 = 0, $9 = 0, $isdigittmp = 0, $isdigittmp274 = 0, $isdigittmp276 = 0, $isdigittmp4$i = 0, $isdigittmp4$i287 = 0, $isdigittmp7$i = 0, $isdigittmp7$i289 = 0, $notrhs$i = 0, $or$cond282 = 0, $storemerge = 0, $storemerge273345 = 0, $storemerge273389 = 0, $storemerge278 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 624 | 0;
 $5 = sp + 24 | 0;
 $6 = sp + 16 | 0;
 $7 = sp + 588 | 0;
 $8 = sp + 576 | 0;
 $9 = sp;
 $10 = sp + 536 | 0;
 $11 = sp + 8 | 0;
 $12 = sp + 528 | 0;
 $13 = ($0 | 0) != 0;
 $14 = $10 + 40 | 0;
 $15 = $14;
 $16 = $10 + 39 | 0;
 $17 = $11 + 4 | 0;
 $18 = $7;
 $19 = 0 - $18 | 0;
 $20 = $8 + 12 | 0;
 $21 = $8 + 11 | 0;
 $22 = $20;
 $23 = $22 - $18 | 0;
 $24 = -2 - $18 | 0;
 $25 = $22 + 2 | 0;
 $26 = $5 + 288 | 0;
 $27 = $7 + 9 | 0;
 $28 = $27;
 $29 = $7 + 8 | 0;
 $$0243 = 0;
 $$0247 = 0;
 $$0269 = 0;
 $$0321 = $1;
 L1 : while (1) {
  do if (($$0247 | 0) > -1) if (($$0243 | 0) > (2147483647 - $$0247 | 0)) {
   HEAP32[(___errno_location() | 0) >> 2] = 75;
   $$1248 = -1;
   break;
  } else {
   $$1248 = $$0243 + $$0247 | 0;
   break;
  } else $$1248 = $$0247; while (0);
  $35 = HEAP8[$$0321 >> 0] | 0;
  if (!($35 << 24 >> 24)) {
   label = 243;
   break;
  } else {
   $$1322 = $$0321;
   $37 = $35;
  }
  L9 : while (1) {
   switch ($37 << 24 >> 24) {
   case 37:
    {
     $$0249383 = $$1322;
     $$2323382 = $$1322;
     label = 9;
     break L9;
     break;
    }
   case 0:
    {
     $$0249$lcssa = $$1322;
     $$2323$lcssa = $$1322;
     break L9;
     break;
    }
   default:
    {}
   }
   $38 = $$1322 + 1 | 0;
   $$1322 = $38;
   $37 = HEAP8[$38 >> 0] | 0;
  }
  L12 : do if ((label | 0) == 9) while (1) {
   label = 0;
   if ((HEAP8[$$2323382 + 1 >> 0] | 0) != 37) {
    $$0249$lcssa = $$0249383;
    $$2323$lcssa = $$2323382;
    break L12;
   }
   $42 = $$0249383 + 1 | 0;
   $43 = $$2323382 + 2 | 0;
   if ((HEAP8[$43 >> 0] | 0) == 37) {
    $$0249383 = $42;
    $$2323382 = $43;
    label = 9;
   } else {
    $$0249$lcssa = $42;
    $$2323$lcssa = $43;
    break;
   }
  } while (0);
  $48 = $$0249$lcssa - $$0321 | 0;
  if ($13) if (!(HEAP32[$0 >> 2] & 32)) ___fwritex($$0321, $48, $0) | 0;
  if ($48 | 0) {
   $$0243 = $48;
   $$0247 = $$1248;
   $$0321 = $$2323$lcssa;
   continue;
  }
  $53 = $$2323$lcssa + 1 | 0;
  $54 = HEAP8[$53 >> 0] | 0;
  $isdigittmp = ($54 << 24 >> 24) + -48 | 0;
  if ($isdigittmp >>> 0 < 10) {
   $58 = (HEAP8[$$2323$lcssa + 2 >> 0] | 0) == 36;
   $$331 = $58 ? $$2323$lcssa + 3 | 0 : $53;
   $$0253 = $58 ? $isdigittmp : -1;
   $$1270 = $58 ? 1 : $$0269;
   $61 = HEAP8[$$331 >> 0] | 0;
   $storemerge = $$331;
  } else {
   $$0253 = -1;
   $$1270 = $$0269;
   $61 = $54;
   $storemerge = $53;
  }
  $62 = ($61 << 24 >> 24) + -32 | 0;
  L25 : do if ($62 >>> 0 < 32) {
   $$0262390 = 0;
   $65 = $62;
   $69 = $61;
   $storemerge273389 = $storemerge;
   while (1) {
    if (!(1 << $65 & 75913)) {
     $$0262342 = $$0262390;
     $78 = $69;
     $storemerge273345 = $storemerge273389;
     break L25;
    }
    $72 = 1 << ($69 << 24 >> 24) + -32 | $$0262390;
    $73 = $storemerge273389 + 1 | 0;
    $74 = HEAP8[$73 >> 0] | 0;
    $65 = ($74 << 24 >> 24) + -32 | 0;
    if ($65 >>> 0 >= 32) {
     $$0262342 = $72;
     $78 = $74;
     $storemerge273345 = $73;
     break;
    } else {
     $$0262390 = $72;
     $69 = $74;
     $storemerge273389 = $73;
    }
   }
  } else {
   $$0262342 = 0;
   $78 = $61;
   $storemerge273345 = $storemerge;
  } while (0);
  do if ($78 << 24 >> 24 == 42) {
   $80 = $storemerge273345 + 1 | 0;
   $81 = HEAP8[$80 >> 0] | 0;
   $isdigittmp276 = ($81 << 24 >> 24) + -48 | 0;
   if ($isdigittmp276 >>> 0 < 10) if ((HEAP8[$storemerge273345 + 2 >> 0] | 0) == 36) {
    HEAP32[$4 + ($isdigittmp276 << 2) >> 2] = 10;
    $$0259 = HEAP32[$3 + ((HEAP8[$80 >> 0] | 0) + -48 << 3) >> 2] | 0;
    $$2271 = 1;
    $storemerge278 = $storemerge273345 + 3 | 0;
   } else label = 24; else label = 24;
   if ((label | 0) == 24) {
    label = 0;
    if ($$1270 | 0) {
     $$0 = -1;
     break L1;
    }
    if (!$13) {
     $$1260 = 0;
     $$1263 = $$0262342;
     $$3272 = 0;
     $$4325 = $80;
     $$pr = $81;
     break;
    }
    $104 = (HEAP32[$2 >> 2] | 0) + (4 - 1) & ~(4 - 1);
    $105 = HEAP32[$104 >> 2] | 0;
    HEAP32[$2 >> 2] = $104 + 4;
    $$0259 = $105;
    $$2271 = 0;
    $storemerge278 = $80;
   }
   $106 = ($$0259 | 0) < 0;
   $$1260 = $106 ? 0 - $$0259 | 0 : $$0259;
   $$1263 = $106 ? $$0262342 | 8192 : $$0262342;
   $$3272 = $$2271;
   $$4325 = $storemerge278;
   $$pr = HEAP8[$storemerge278 >> 0] | 0;
  } else {
   $isdigittmp4$i = ($78 << 24 >> 24) + -48 | 0;
   if ($isdigittmp4$i >>> 0 < 10) {
    $$06$i = 0;
    $113 = $storemerge273345;
    $isdigittmp7$i = $isdigittmp4$i;
    do {
     $$06$i = ($$06$i * 10 | 0) + $isdigittmp7$i | 0;
     $113 = $113 + 1 | 0;
     $114 = HEAP8[$113 >> 0] | 0;
     $isdigittmp7$i = ($114 << 24 >> 24) + -48 | 0;
    } while ($isdigittmp7$i >>> 0 < 10);
    if (($$06$i | 0) < 0) {
     $$0 = -1;
     break L1;
    } else {
     $$1260 = $$06$i;
     $$1263 = $$0262342;
     $$3272 = $$1270;
     $$4325 = $113;
     $$pr = $114;
    }
   } else {
    $$1260 = 0;
    $$1263 = $$0262342;
    $$3272 = $$1270;
    $$4325 = $storemerge273345;
    $$pr = $78;
   }
  } while (0);
  L45 : do if ($$pr << 24 >> 24 == 46) {
   $118 = $$4325 + 1 | 0;
   $119 = HEAP8[$118 >> 0] | 0;
   if ($119 << 24 >> 24 != 42) {
    $isdigittmp4$i287 = ($119 << 24 >> 24) + -48 | 0;
    if ($isdigittmp4$i287 >>> 0 < 10) {
     $$06$i290 = 0;
     $151 = $118;
     $isdigittmp7$i289 = $isdigittmp4$i287;
    } else {
     $$0254 = 0;
     $$6 = $118;
     break;
    }
    while (1) {
     $149 = ($$06$i290 * 10 | 0) + $isdigittmp7$i289 | 0;
     $150 = $151 + 1 | 0;
     $isdigittmp7$i289 = (HEAP8[$150 >> 0] | 0) + -48 | 0;
     if ($isdigittmp7$i289 >>> 0 >= 10) {
      $$0254 = $149;
      $$6 = $150;
      break L45;
     } else {
      $$06$i290 = $149;
      $151 = $150;
     }
    }
   }
   $121 = $$4325 + 2 | 0;
   $isdigittmp274 = (HEAP8[$121 >> 0] | 0) + -48 | 0;
   if ($isdigittmp274 >>> 0 < 10) if ((HEAP8[$$4325 + 3 >> 0] | 0) == 36) {
    HEAP32[$4 + ($isdigittmp274 << 2) >> 2] = 10;
    $$0254 = HEAP32[$3 + ((HEAP8[$121 >> 0] | 0) + -48 << 3) >> 2] | 0;
    $$6 = $$4325 + 4 | 0;
    break;
   }
   if ($$3272 | 0) {
    $$0 = -1;
    break L1;
   }
   if ($13) {
    $145 = (HEAP32[$2 >> 2] | 0) + (4 - 1) & ~(4 - 1);
    $146 = HEAP32[$145 >> 2] | 0;
    HEAP32[$2 >> 2] = $145 + 4;
    $$0254 = $146;
    $$6 = $121;
   } else {
    $$0254 = 0;
    $$6 = $121;
   }
  } else {
   $$0254 = -1;
   $$6 = $$4325;
  } while (0);
  $$0252 = 0;
  $$7 = $$6;
  while (1) {
   $156 = (HEAP8[$$7 >> 0] | 0) + -65 | 0;
   if ($156 >>> 0 > 57) {
    $$0 = -1;
    break L1;
   }
   $158 = $$7 + 1 | 0;
   $160 = HEAP8[14799 + ($$0252 * 58 | 0) + $156 >> 0] | 0;
   $161 = $160 & 255;
   if (($161 + -1 | 0) >>> 0 < 8) {
    $$0252 = $161;
    $$7 = $158;
   } else break;
  }
  if (!($160 << 24 >> 24)) {
   $$0 = -1;
   break;
  }
  $166 = ($$0253 | 0) > -1;
  do if ($160 << 24 >> 24 == 19) if ($166) {
   $$0 = -1;
   break L1;
  } else label = 51; else {
   if ($166) {
    HEAP32[$4 + ($$0253 << 2) >> 2] = $161;
    $169 = $3 + ($$0253 << 3) | 0;
    $174 = HEAP32[$169 + 4 >> 2] | 0;
    $175 = $9;
    HEAP32[$175 >> 2] = HEAP32[$169 >> 2];
    HEAP32[$175 + 4 >> 2] = $174;
    label = 51;
    break;
   }
   if (!$13) {
    $$0 = 0;
    break L1;
   }
   _pop_arg_588($9, $161, $2);
  } while (0);
  if ((label | 0) == 51) {
   label = 0;
   if (!$13) {
    $$0243 = 0;
    $$0247 = $$1248;
    $$0269 = $$3272;
    $$0321 = $158;
    continue;
   }
  }
  $180 = HEAP8[$$7 >> 0] | 0;
  $$0235 = ($$0252 | 0) != 0 & ($180 & 15 | 0) == 3 ? $180 & -33 : $180;
  $187 = $$1263 & -65537;
  $$1263$ = ($$1263 & 8192 | 0) == 0 ? $$1263 : $187;
  L74 : do switch ($$0235 | 0) {
  case 110:
   {
    switch (($$0252 & 255) << 24 >> 24) {
    case 0:
     {
      HEAP32[HEAP32[$9 >> 2] >> 2] = $$1248;
      $$0243 = 0;
      $$0247 = $$1248;
      $$0269 = $$3272;
      $$0321 = $158;
      continue L1;
      break;
     }
    case 1:
     {
      HEAP32[HEAP32[$9 >> 2] >> 2] = $$1248;
      $$0243 = 0;
      $$0247 = $$1248;
      $$0269 = $$3272;
      $$0321 = $158;
      continue L1;
      break;
     }
    case 2:
     {
      $199 = HEAP32[$9 >> 2] | 0;
      HEAP32[$199 >> 2] = $$1248;
      HEAP32[$199 + 4 >> 2] = (($$1248 | 0) < 0) << 31 >> 31;
      $$0243 = 0;
      $$0247 = $$1248;
      $$0269 = $$3272;
      $$0321 = $158;
      continue L1;
      break;
     }
    case 3:
     {
      HEAP16[HEAP32[$9 >> 2] >> 1] = $$1248;
      $$0243 = 0;
      $$0247 = $$1248;
      $$0269 = $$3272;
      $$0321 = $158;
      continue L1;
      break;
     }
    case 4:
     {
      HEAP8[HEAP32[$9 >> 2] >> 0] = $$1248;
      $$0243 = 0;
      $$0247 = $$1248;
      $$0269 = $$3272;
      $$0321 = $158;
      continue L1;
      break;
     }
    case 6:
     {
      HEAP32[HEAP32[$9 >> 2] >> 2] = $$1248;
      $$0243 = 0;
      $$0247 = $$1248;
      $$0269 = $$3272;
      $$0321 = $158;
      continue L1;
      break;
     }
    case 7:
     {
      $211 = HEAP32[$9 >> 2] | 0;
      HEAP32[$211 >> 2] = $$1248;
      HEAP32[$211 + 4 >> 2] = (($$1248 | 0) < 0) << 31 >> 31;
      $$0243 = 0;
      $$0247 = $$1248;
      $$0269 = $$3272;
      $$0321 = $158;
      continue L1;
      break;
     }
    default:
     {
      $$0243 = 0;
      $$0247 = $$1248;
      $$0269 = $$3272;
      $$0321 = $158;
      continue L1;
     }
    }
    break;
   }
  case 112:
   {
    $$1236 = 120;
    $$1255 = $$0254 >>> 0 > 8 ? $$0254 : 8;
    $$3265 = $$1263$ | 8;
    label = 63;
    break;
   }
  case 88:
  case 120:
   {
    $$1236 = $$0235;
    $$1255 = $$0254;
    $$3265 = $$1263$;
    label = 63;
    break;
   }
  case 111:
   {
    $257 = $9;
    $259 = HEAP32[$257 >> 2] | 0;
    $262 = HEAP32[$257 + 4 >> 2] | 0;
    if (($259 | 0) == 0 & ($262 | 0) == 0) $$0$lcssa$i300 = $14; else {
     $$06$i298 = $14;
     $267 = $259;
     $271 = $262;
     while (1) {
      $270 = $$06$i298 + -1 | 0;
      HEAP8[$270 >> 0] = $267 & 7 | 48;
      $267 = _bitshift64Lshr($267 | 0, $271 | 0, 3) | 0;
      $271 = tempRet0;
      if (($267 | 0) == 0 & ($271 | 0) == 0) {
       $$0$lcssa$i300 = $270;
       break;
      } else $$06$i298 = $270;
     }
    }
    if (!($$1263$ & 8)) {
     $$0228 = $$0$lcssa$i300;
     $$1233 = 0;
     $$1238 = 15279;
     $$2256 = $$0254;
     $$4266 = $$1263$;
     label = 76;
    } else {
     $280 = $15 - $$0$lcssa$i300 | 0;
     $$0228 = $$0$lcssa$i300;
     $$1233 = 0;
     $$1238 = 15279;
     $$2256 = ($$0254 | 0) > ($280 | 0) ? $$0254 : $280 + 1 | 0;
     $$4266 = $$1263$;
     label = 76;
    }
    break;
   }
  case 105:
  case 100:
   {
    $283 = $9;
    $285 = HEAP32[$283 >> 2] | 0;
    $288 = HEAP32[$283 + 4 >> 2] | 0;
    if (($288 | 0) < 0) {
     $290 = _i64Subtract(0, 0, $285 | 0, $288 | 0) | 0;
     $291 = tempRet0;
     $292 = $9;
     HEAP32[$292 >> 2] = $290;
     HEAP32[$292 + 4 >> 2] = $291;
     $$0232 = 1;
     $$0237 = 15279;
     $300 = $290;
     $301 = $291;
     label = 75;
     break L74;
    }
    if (!($$1263$ & 2048)) {
     $298 = $$1263$ & 1;
     $$0232 = $298;
     $$0237 = ($298 | 0) == 0 ? 15279 : 15281;
     $300 = $285;
     $301 = $288;
     label = 75;
    } else {
     $$0232 = 1;
     $$0237 = 15280;
     $300 = $285;
     $301 = $288;
     label = 75;
    }
    break;
   }
  case 117:
   {
    $188 = $9;
    $$0232 = 0;
    $$0237 = 15279;
    $300 = HEAP32[$188 >> 2] | 0;
    $301 = HEAP32[$188 + 4 >> 2] | 0;
    label = 75;
    break;
   }
  case 99:
   {
    HEAP8[$16 >> 0] = HEAP32[$9 >> 2];
    $$2 = $16;
    $$2234 = 0;
    $$2239 = 15279;
    $$2251 = $14;
    $$5 = 1;
    $$6268 = $187;
    break;
   }
  case 109:
   {
    $$1 = _strerror(HEAP32[(___errno_location() | 0) >> 2] | 0) | 0;
    label = 81;
    break;
   }
  case 115:
   {
    $331 = HEAP32[$9 >> 2] | 0;
    $$1 = $331 | 0 ? $331 : 15289;
    label = 81;
    break;
   }
  case 67:
   {
    HEAP32[$11 >> 2] = HEAP32[$9 >> 2];
    HEAP32[$17 >> 2] = 0;
    HEAP32[$9 >> 2] = $11;
    $$4258458 = -1;
    $809 = $11;
    label = 85;
    break;
   }
  case 83:
   {
    $$pre454 = HEAP32[$9 >> 2] | 0;
    if (!$$0254) {
     _pad($0, 32, $$1260, 0, $$1263$);
     $$0240$lcssa460 = 0;
     label = 96;
    } else {
     $$4258458 = $$0254;
     $809 = $$pre454;
     label = 85;
    }
    break;
   }
  case 65:
  case 71:
  case 70:
  case 69:
  case 97:
  case 103:
  case 102:
  case 101:
   {
    $371 = +HEAPF64[$9 >> 3];
    HEAP32[$6 >> 2] = 0;
    HEAPF64[tempDoublePtr >> 3] = $371;
    if ((HEAP32[tempDoublePtr + 4 >> 2] | 0) < 0) {
     $$0471$i = -$371;
     $$0520$i = 1;
     $$0521$i = 15296;
    } else {
     $378 = $$1263$ & 1;
     if (!($$1263$ & 2048)) {
      $$0471$i = $371;
      $$0520$i = $378;
      $$0521$i = ($378 | 0) == 0 ? 15297 : 15302;
     } else {
      $$0471$i = $371;
      $$0520$i = 1;
      $$0521$i = 15299;
     }
    }
    HEAPF64[tempDoublePtr >> 3] = $$0471$i;
    $382 = HEAP32[tempDoublePtr + 4 >> 2] & 2146435072;
    do if ($382 >>> 0 < 2146435072 | ($382 | 0) == 2146435072 & 0 < 0) {
     $404 = +_frexpl($$0471$i, $6) * 2.0;
     $405 = $404 != 0.0;
     if ($405) HEAP32[$6 >> 2] = (HEAP32[$6 >> 2] | 0) + -1;
     $408 = $$0235 | 32;
     if (($408 | 0) == 97) {
      $410 = $$0235 & 32;
      $$0521$$i = ($410 | 0) == 0 ? $$0521$i : $$0521$i + 9 | 0;
      $413 = $$0520$i | 2;
      $415 = 12 - $$0254 | 0;
      do if ($$0254 >>> 0 > 11 | ($415 | 0) == 0) $$1472$i = $404; else {
       $$0509591$i = 8.0;
       $$1508592$i = $415;
       do {
        $$1508592$i = $$1508592$i + -1 | 0;
        $$0509591$i = $$0509591$i * 16.0;
       } while (($$1508592$i | 0) != 0);
       if ((HEAP8[$$0521$$i >> 0] | 0) == 45) {
        $$1472$i = -($$0509591$i + (-$404 - $$0509591$i));
        break;
       } else {
        $$1472$i = $404 + $$0509591$i - $$0509591$i;
        break;
       }
      } while (0);
      $429 = HEAP32[$6 >> 2] | 0;
      $432 = ($429 | 0) < 0 ? 0 - $429 | 0 : $429;
      $435 = _fmt_u($432, (($432 | 0) < 0) << 31 >> 31, $20) | 0;
      if (($435 | 0) == ($20 | 0)) {
       HEAP8[$21 >> 0] = 48;
       $$0511$i = $21;
      } else $$0511$i = $435;
      HEAP8[$$0511$i + -1 >> 0] = ($429 >> 31 & 2) + 43;
      $444 = $$0511$i + -2 | 0;
      HEAP8[$444 >> 0] = $$0235 + 15;
      $notrhs$i = ($$0254 | 0) < 1;
      $446 = ($$1263$ & 8 | 0) == 0;
      $$0523$i = $7;
      $$2473$i = $$1472$i;
      while (1) {
       $447 = ~~$$2473$i;
       $453 = $$0523$i + 1 | 0;
       HEAP8[$$0523$i >> 0] = HEAPU8[15263 + $447 >> 0] | $410;
       $$2473$i = ($$2473$i - +($447 | 0)) * 16.0;
       do if (($453 - $18 | 0) == 1) {
        if ($446 & ($notrhs$i & $$2473$i == 0.0)) {
         $$1524$i = $453;
         break;
        }
        HEAP8[$453 >> 0] = 46;
        $$1524$i = $$0523$i + 2 | 0;
       } else $$1524$i = $453; while (0);
       if (!($$2473$i != 0.0)) break; else $$0523$i = $$1524$i;
      }
      $$pre699$i = $$1524$i;
      $465 = $444;
      $$0525$i = ($$0254 | 0) != 0 & ($24 + $$pre699$i | 0) < ($$0254 | 0) ? $25 + $$0254 - $465 | 0 : $23 - $465 + $$pre699$i | 0;
      $470 = $$0525$i + $413 | 0;
      _pad($0, 32, $$1260, $470, $$1263$);
      if (!(HEAP32[$0 >> 2] & 32)) ___fwritex($$0521$$i, $413, $0) | 0;
      _pad($0, 48, $$1260, $470, $$1263$ ^ 65536);
      $475 = $$pre699$i - $18 | 0;
      if (!(HEAP32[$0 >> 2] & 32)) ___fwritex($7, $475, $0) | 0;
      $479 = $22 - $465 | 0;
      _pad($0, 48, $$0525$i - ($475 + $479) | 0, 0, 0);
      if (!(HEAP32[$0 >> 2] & 32)) ___fwritex($444, $479, $0) | 0;
      _pad($0, 32, $$1260, $470, $$1263$ ^ 8192);
      $$0470$i = ($470 | 0) < ($$1260 | 0) ? $$1260 : $470;
      break;
     }
     $$537$i = ($$0254 | 0) < 0 ? 6 : $$0254;
     if ($405) {
      $489 = (HEAP32[$6 >> 2] | 0) + -28 | 0;
      HEAP32[$6 >> 2] = $489;
      $$3$i = $404 * 268435456.0;
      $$pr$i = $489;
     } else {
      $$3$i = $404;
      $$pr$i = HEAP32[$6 >> 2] | 0;
     }
     $$553$i = ($$pr$i | 0) < 0 ? $5 : $26;
     $$0498$i = $$553$i;
     $$4$i = $$3$i;
     do {
      $491 = ~~$$4$i >>> 0;
      HEAP32[$$0498$i >> 2] = $491;
      $$0498$i = $$0498$i + 4 | 0;
      $$4$i = ($$4$i - +($491 >>> 0)) * 1.0e9;
     } while ($$4$i != 0.0);
     if (($$pr$i | 0) > 0) {
      $$1482670$i = $$553$i;
      $$1499669$i = $$0498$i;
      $498 = $$pr$i;
      while (1) {
       $500 = ($498 | 0) > 29 ? 29 : $498;
       $$0488662$i = $$1499669$i + -4 | 0;
       do if ($$0488662$i >>> 0 < $$1482670$i >>> 0) $$2483$ph$i = $$1482670$i; else {
        $$0488664$i = $$0488662$i;
        $$0497663$i = 0;
        do {
         $503 = _bitshift64Shl(HEAP32[$$0488664$i >> 2] | 0, 0, $500 | 0) | 0;
         $505 = _i64Add($503 | 0, tempRet0 | 0, $$0497663$i | 0, 0) | 0;
         $506 = tempRet0;
         $507 = ___uremdi3($505 | 0, $506 | 0, 1e9, 0) | 0;
         HEAP32[$$0488664$i >> 2] = $507;
         $$0497663$i = ___udivdi3($505 | 0, $506 | 0, 1e9, 0) | 0;
         $$0488664$i = $$0488664$i + -4 | 0;
        } while ($$0488664$i >>> 0 >= $$1482670$i >>> 0);
        if (!$$0497663$i) {
         $$2483$ph$i = $$1482670$i;
         break;
        }
        $513 = $$1482670$i + -4 | 0;
        HEAP32[$513 >> 2] = $$0497663$i;
        $$2483$ph$i = $513;
       } while (0);
       $$2500$i = $$1499669$i;
       while (1) {
        if ($$2500$i >>> 0 <= $$2483$ph$i >>> 0) break;
        $515 = $$2500$i + -4 | 0;
        if (!(HEAP32[$515 >> 2] | 0)) $$2500$i = $515; else break;
       }
       $519 = (HEAP32[$6 >> 2] | 0) - $500 | 0;
       HEAP32[$6 >> 2] = $519;
       if (($519 | 0) > 0) {
        $$1482670$i = $$2483$ph$i;
        $$1499669$i = $$2500$i;
        $498 = $519;
       } else {
        $$1482$lcssa$i = $$2483$ph$i;
        $$1499$lcssa$i = $$2500$i;
        $$pr570$i = $519;
        break;
       }
      }
     } else {
      $$1482$lcssa$i = $$553$i;
      $$1499$lcssa$i = $$0498$i;
      $$pr570$i = $$pr$i;
     }
     if (($$pr570$i | 0) < 0) {
      $524 = (($$537$i + 25 | 0) / 9 | 0) + 1 | 0;
      $525 = ($408 | 0) == 102;
      $$3484657$i = $$1482$lcssa$i;
      $$3501656$i = $$1499$lcssa$i;
      $527 = $$pr570$i;
      while (1) {
       $526 = 0 - $527 | 0;
       $529 = ($526 | 0) > 9 ? 9 : $526;
       do if ($$3484657$i >>> 0 < $$3501656$i >>> 0) {
        $535 = (1 << $529) + -1 | 0;
        $536 = 1e9 >>> $529;
        $$0487651$i = 0;
        $$1489650$i = $$3484657$i;
        do {
         $537 = HEAP32[$$1489650$i >> 2] | 0;
         HEAP32[$$1489650$i >> 2] = ($537 >>> $529) + $$0487651$i;
         $$0487651$i = Math_imul($537 & $535, $536) | 0;
         $$1489650$i = $$1489650$i + 4 | 0;
        } while ($$1489650$i >>> 0 < $$3501656$i >>> 0);
        $$$3484$i = (HEAP32[$$3484657$i >> 2] | 0) == 0 ? $$3484657$i + 4 | 0 : $$3484657$i;
        if (!$$0487651$i) {
         $$$3484705$i = $$$3484$i;
         $$4502$i = $$3501656$i;
         break;
        }
        HEAP32[$$3501656$i >> 2] = $$0487651$i;
        $$$3484705$i = $$$3484$i;
        $$4502$i = $$3501656$i + 4 | 0;
       } else {
        $$$3484705$i = (HEAP32[$$3484657$i >> 2] | 0) == 0 ? $$3484657$i + 4 | 0 : $$3484657$i;
        $$4502$i = $$3501656$i;
       } while (0);
       $549 = $525 ? $$553$i : $$$3484705$i;
       $$$4502$i = ($$4502$i - $549 >> 2 | 0) > ($524 | 0) ? $549 + ($524 << 2) | 0 : $$4502$i;
       $527 = (HEAP32[$6 >> 2] | 0) + $529 | 0;
       HEAP32[$6 >> 2] = $527;
       if (($527 | 0) >= 0) {
        $$3484$lcssa$i = $$$3484705$i;
        $$3501$lcssa$i = $$$4502$i;
        break;
       } else {
        $$3484657$i = $$$3484705$i;
        $$3501656$i = $$$4502$i;
       }
      }
     } else {
      $$3484$lcssa$i = $$1482$lcssa$i;
      $$3501$lcssa$i = $$1499$lcssa$i;
     }
     $560 = $$553$i;
     do if ($$3484$lcssa$i >>> 0 < $$3501$lcssa$i >>> 0) {
      $564 = ($560 - $$3484$lcssa$i >> 2) * 9 | 0;
      $565 = HEAP32[$$3484$lcssa$i >> 2] | 0;
      if ($565 >>> 0 < 10) {
       $$1515$i = $564;
       break;
      } else {
       $$0514646$i = $564;
       $$0530645$i = 10;
      }
      while (1) {
       $$0530645$i = $$0530645$i * 10 | 0;
       $568 = $$0514646$i + 1 | 0;
       if ($565 >>> 0 < $$0530645$i >>> 0) {
        $$1515$i = $568;
        break;
       } else $$0514646$i = $568;
      }
     } else $$1515$i = 0; while (0);
     $573 = ($408 | 0) == 103;
     $574 = ($$537$i | 0) != 0;
     $576 = $$537$i - (($408 | 0) != 102 ? $$1515$i : 0) + (($574 & $573) << 31 >> 31) | 0;
     if (($576 | 0) < ((($$3501$lcssa$i - $560 >> 2) * 9 | 0) + -9 | 0)) {
      $584 = $576 + 9216 | 0;
      $587 = $$553$i + 4 + ((($584 | 0) / 9 | 0) + -1024 << 2) | 0;
      $$0527638$i = (($584 | 0) % 9 | 0) + 1 | 0;
      if (($$0527638$i | 0) < 9) {
       $$0527640$i = $$0527638$i;
       $$1531639$i = 10;
       while (1) {
        $590 = $$1531639$i * 10 | 0;
        $$0527640$i = $$0527640$i + 1 | 0;
        if (($$0527640$i | 0) == 9) {
         $$1531$lcssa$i = $590;
         break;
        } else $$1531639$i = $590;
       }
      } else $$1531$lcssa$i = 10;
      $591 = HEAP32[$587 >> 2] | 0;
      $592 = ($591 >>> 0) % ($$1531$lcssa$i >>> 0) | 0;
      $595 = ($587 + 4 | 0) == ($$3501$lcssa$i | 0);
      do if ($595 & ($592 | 0) == 0) {
       $$4492$i = $587;
       $$4518$i = $$1515$i;
       $$8$i = $$3484$lcssa$i;
      } else {
       $$540$i = ((($591 >>> 0) / ($$1531$lcssa$i >>> 0) | 0) & 1 | 0) == 0 ? 9007199254740992.0 : 9007199254740994.0;
       $599 = ($$1531$lcssa$i | 0) / 2 | 0;
       if ($592 >>> 0 < $599 >>> 0) $$0466$i = .5; else $$0466$i = $595 & ($592 | 0) == ($599 | 0) ? 1.0 : 1.5;
       do if (!$$0520$i) {
        $$1467$i = $$0466$i;
        $$1469$i = $$540$i;
       } else {
        if ((HEAP8[$$0521$i >> 0] | 0) != 45) {
         $$1467$i = $$0466$i;
         $$1469$i = $$540$i;
         break;
        }
        $$1467$i = -$$0466$i;
        $$1469$i = -$$540$i;
       } while (0);
       $607 = $591 - $592 | 0;
       HEAP32[$587 >> 2] = $607;
       if (!($$1469$i + $$1467$i != $$1469$i)) {
        $$4492$i = $587;
        $$4518$i = $$1515$i;
        $$8$i = $$3484$lcssa$i;
        break;
       }
       $610 = $607 + $$1531$lcssa$i | 0;
       HEAP32[$587 >> 2] = $610;
       if ($610 >>> 0 > 999999999) {
        $$2490631$i = $587;
        $$5486632$i = $$3484$lcssa$i;
        while (1) {
         $612 = $$2490631$i + -4 | 0;
         HEAP32[$$2490631$i >> 2] = 0;
         if ($612 >>> 0 < $$5486632$i >>> 0) {
          $614 = $$5486632$i + -4 | 0;
          HEAP32[$614 >> 2] = 0;
          $$6$i = $614;
         } else $$6$i = $$5486632$i;
         $616 = (HEAP32[$612 >> 2] | 0) + 1 | 0;
         HEAP32[$612 >> 2] = $616;
         if ($616 >>> 0 > 999999999) {
          $$2490631$i = $612;
          $$5486632$i = $$6$i;
         } else {
          $$2490$lcssa$i = $612;
          $$5486$lcssa$i = $$6$i;
          break;
         }
        }
       } else {
        $$2490$lcssa$i = $587;
        $$5486$lcssa$i = $$3484$lcssa$i;
       }
       $621 = ($560 - $$5486$lcssa$i >> 2) * 9 | 0;
       $622 = HEAP32[$$5486$lcssa$i >> 2] | 0;
       if ($622 >>> 0 < 10) {
        $$4492$i = $$2490$lcssa$i;
        $$4518$i = $621;
        $$8$i = $$5486$lcssa$i;
        break;
       } else {
        $$2516627$i = $621;
        $$2532626$i = 10;
       }
       while (1) {
        $$2532626$i = $$2532626$i * 10 | 0;
        $625 = $$2516627$i + 1 | 0;
        if ($622 >>> 0 < $$2532626$i >>> 0) {
         $$4492$i = $$2490$lcssa$i;
         $$4518$i = $625;
         $$8$i = $$5486$lcssa$i;
         break;
        } else $$2516627$i = $625;
       }
      } while (0);
      $627 = $$4492$i + 4 | 0;
      $$5519$ph$i = $$4518$i;
      $$7505$ph$i = $$3501$lcssa$i >>> 0 > $627 >>> 0 ? $627 : $$3501$lcssa$i;
      $$9$ph$i = $$8$i;
     } else {
      $$5519$ph$i = $$1515$i;
      $$7505$ph$i = $$3501$lcssa$i;
      $$9$ph$i = $$3484$lcssa$i;
     }
     $629 = 0 - $$5519$ph$i | 0;
     $$7505$i = $$7505$ph$i;
     while (1) {
      if ($$7505$i >>> 0 <= $$9$ph$i >>> 0) {
       $$lcssa682$i = 0;
       break;
      }
      $631 = $$7505$i + -4 | 0;
      if (!(HEAP32[$631 >> 2] | 0)) $$7505$i = $631; else {
       $$lcssa682$i = 1;
       break;
      }
     }
     do if ($573) {
      $$537$$i = ($574 & 1 ^ 1) + $$537$i | 0;
      if (($$537$$i | 0) > ($$5519$ph$i | 0) & ($$5519$ph$i | 0) > -5) {
       $$0479$i = $$0235 + -1 | 0;
       $$2476$i = $$537$$i + -1 - $$5519$ph$i | 0;
      } else {
       $$0479$i = $$0235 + -2 | 0;
       $$2476$i = $$537$$i + -1 | 0;
      }
      $642 = $$1263$ & 8;
      if ($642 | 0) {
       $$1480$i = $$0479$i;
       $$3477$i = $$2476$i;
       $$pre$phi703$iZ2D = $642;
       break;
      }
      do if ($$lcssa682$i) {
       $645 = HEAP32[$$7505$i + -4 >> 2] | 0;
       if (!$645) {
        $$2529$i = 9;
        break;
       }
       if (!(($645 >>> 0) % 10 | 0)) {
        $$1528623$i = 0;
        $$3533622$i = 10;
       } else {
        $$2529$i = 0;
        break;
       }
       while (1) {
        $$3533622$i = $$3533622$i * 10 | 0;
        $650 = $$1528623$i + 1 | 0;
        if (($645 >>> 0) % ($$3533622$i >>> 0) | 0 | 0) {
         $$2529$i = $650;
         break;
        } else $$1528623$i = $650;
       }
      } else $$2529$i = 9; while (0);
      $659 = (($$7505$i - $560 >> 2) * 9 | 0) + -9 | 0;
      if (($$0479$i | 32 | 0) == 102) {
       $660 = $659 - $$2529$i | 0;
       $$543$i = ($660 | 0) < 0 ? 0 : $660;
       $$1480$i = $$0479$i;
       $$3477$i = ($$2476$i | 0) < ($$543$i | 0) ? $$2476$i : $$543$i;
       $$pre$phi703$iZ2D = 0;
       break;
      } else {
       $664 = $659 + $$5519$ph$i - $$2529$i | 0;
       $$545$i = ($664 | 0) < 0 ? 0 : $664;
       $$1480$i = $$0479$i;
       $$3477$i = ($$2476$i | 0) < ($$545$i | 0) ? $$2476$i : $$545$i;
       $$pre$phi703$iZ2D = 0;
       break;
      }
     } else {
      $$1480$i = $$0235;
      $$3477$i = $$537$i;
      $$pre$phi703$iZ2D = $$1263$ & 8;
     } while (0);
     $667 = $$3477$i | $$pre$phi703$iZ2D;
     $669 = ($667 | 0) != 0 & 1;
     $671 = ($$1480$i | 32 | 0) == 102;
     if ($671) {
      $$2513$i = 0;
      $$pn$i = ($$5519$ph$i | 0) > 0 ? $$5519$ph$i : 0;
     } else {
      $675 = ($$5519$ph$i | 0) < 0 ? $629 : $$5519$ph$i;
      $678 = _fmt_u($675, (($675 | 0) < 0) << 31 >> 31, $20) | 0;
      if (($22 - $678 | 0) < 2) {
       $$1512616$i = $678;
       while (1) {
        $682 = $$1512616$i + -1 | 0;
        HEAP8[$682 >> 0] = 48;
        if (($22 - $682 | 0) < 2) $$1512616$i = $682; else {
         $$1512$lcssa$i = $682;
         break;
        }
       }
      } else $$1512$lcssa$i = $678;
      HEAP8[$$1512$lcssa$i + -1 >> 0] = ($$5519$ph$i >> 31 & 2) + 43;
      $692 = $$1512$lcssa$i + -2 | 0;
      HEAP8[$692 >> 0] = $$1480$i;
      $$2513$i = $692;
      $$pn$i = $22 - $692 | 0;
     }
     $697 = $$0520$i + 1 + $$3477$i + $669 + $$pn$i | 0;
     _pad($0, 32, $$1260, $697, $$1263$);
     if (!(HEAP32[$0 >> 2] & 32)) ___fwritex($$0521$i, $$0520$i, $0) | 0;
     _pad($0, 48, $$1260, $697, $$1263$ ^ 65536);
     do if ($671) {
      $$0496$$9$i = $$9$ph$i >>> 0 > $$553$i >>> 0 ? $$553$i : $$9$ph$i;
      $$5493605$i = $$0496$$9$i;
      do {
       $704 = _fmt_u(HEAP32[$$5493605$i >> 2] | 0, 0, $27) | 0;
       do if (($$5493605$i | 0) == ($$0496$$9$i | 0)) {
        if (($704 | 0) != ($27 | 0)) {
         $$1465$i = $704;
         break;
        }
        HEAP8[$29 >> 0] = 48;
        $$1465$i = $29;
       } else {
        if ($704 >>> 0 <= $7 >>> 0) {
         $$1465$i = $704;
         break;
        }
        _memset($7 | 0, 48, $704 - $18 | 0) | 0;
        $$0464602$i = $704;
        while (1) {
         $709 = $$0464602$i + -1 | 0;
         if ($709 >>> 0 > $7 >>> 0) $$0464602$i = $709; else {
          $$1465$i = $709;
          break;
         }
        }
       } while (0);
       if (!(HEAP32[$0 >> 2] & 32)) ___fwritex($$1465$i, $28 - $$1465$i | 0, $0) | 0;
       $$5493605$i = $$5493605$i + 4 | 0;
      } while ($$5493605$i >>> 0 <= $$553$i >>> 0);
      do if ($667 | 0) {
       if (HEAP32[$0 >> 2] & 32 | 0) break;
       ___fwritex(15331, 1, $0) | 0;
      } while (0);
      if (($$3477$i | 0) > 0 & $$5493605$i >>> 0 < $$7505$i >>> 0) {
       $$4478599$i = $$3477$i;
       $$6494598$i = $$5493605$i;
       while (1) {
        $727 = _fmt_u(HEAP32[$$6494598$i >> 2] | 0, 0, $27) | 0;
        if ($727 >>> 0 > $7 >>> 0) {
         _memset($7 | 0, 48, $727 - $18 | 0) | 0;
         $$0463593$i = $727;
         while (1) {
          $731 = $$0463593$i + -1 | 0;
          if ($731 >>> 0 > $7 >>> 0) $$0463593$i = $731; else {
           $$0463$lcssa$i = $731;
           break;
          }
         }
        } else $$0463$lcssa$i = $727;
        if (!(HEAP32[$0 >> 2] & 32)) ___fwritex($$0463$lcssa$i, ($$4478599$i | 0) > 9 ? 9 : $$4478599$i, $0) | 0;
        $$6494598$i = $$6494598$i + 4 | 0;
        $739 = $$4478599$i + -9 | 0;
        if (!(($$4478599$i | 0) > 9 & $$6494598$i >>> 0 < $$7505$i >>> 0)) {
         $$4478$lcssa$i = $739;
         break;
        } else $$4478599$i = $739;
       }
      } else $$4478$lcssa$i = $$3477$i;
      _pad($0, 48, $$4478$lcssa$i + 9 | 0, 9, 0);
     } else {
      $$7505$$i = $$lcssa682$i ? $$7505$i : $$9$ph$i + 4 | 0;
      if (($$3477$i | 0) > -1) {
       $746 = ($$pre$phi703$iZ2D | 0) == 0;
       $$5610$i = $$3477$i;
       $$7495609$i = $$9$ph$i;
       while (1) {
        $748 = _fmt_u(HEAP32[$$7495609$i >> 2] | 0, 0, $27) | 0;
        if (($748 | 0) == ($27 | 0)) {
         HEAP8[$29 >> 0] = 48;
         $$0$i = $29;
        } else $$0$i = $748;
        do if (($$7495609$i | 0) == ($$9$ph$i | 0)) {
         $754 = $$0$i + 1 | 0;
         if (!(HEAP32[$0 >> 2] & 32)) ___fwritex($$0$i, 1, $0) | 0;
         if ($746 & ($$5610$i | 0) < 1) {
          $$2$i = $754;
          break;
         }
         if (HEAP32[$0 >> 2] & 32 | 0) {
          $$2$i = $754;
          break;
         }
         ___fwritex(15331, 1, $0) | 0;
         $$2$i = $754;
        } else {
         if ($$0$i >>> 0 <= $7 >>> 0) {
          $$2$i = $$0$i;
          break;
         }
         _memset($7 | 0, 48, $$0$i + $19 | 0) | 0;
         $$1606$i = $$0$i;
         while (1) {
          $752 = $$1606$i + -1 | 0;
          if ($752 >>> 0 > $7 >>> 0) $$1606$i = $752; else {
           $$2$i = $752;
           break;
          }
         }
        } while (0);
        $763 = $28 - $$2$i | 0;
        if (!(HEAP32[$0 >> 2] & 32)) ___fwritex($$2$i, ($$5610$i | 0) > ($763 | 0) ? $763 : $$5610$i, $0) | 0;
        $769 = $$5610$i - $763 | 0;
        $$7495609$i = $$7495609$i + 4 | 0;
        if (!($$7495609$i >>> 0 < $$7505$$i >>> 0 & ($769 | 0) > -1)) {
         $$5$lcssa$i = $769;
         break;
        } else $$5610$i = $769;
       }
      } else $$5$lcssa$i = $$3477$i;
      _pad($0, 48, $$5$lcssa$i + 18 | 0, 18, 0);
      if (HEAP32[$0 >> 2] & 32 | 0) break;
      ___fwritex($$2513$i, $22 - $$2513$i | 0, $0) | 0;
     } while (0);
     _pad($0, 32, $$1260, $697, $$1263$ ^ 8192);
     $$0470$i = ($697 | 0) < ($$1260 | 0) ? $$1260 : $697;
    } else {
     $389 = ($$0235 & 32 | 0) != 0;
     $393 = $$0520$i + 3 | 0;
     _pad($0, 32, $$1260, $393, $187);
     $394 = HEAP32[$0 >> 2] | 0;
     if (!($394 & 32)) {
      ___fwritex($$0521$i, $$0520$i, $0) | 0;
      $398 = HEAP32[$0 >> 2] | 0;
     } else $398 = $394;
     if (!($398 & 32)) ___fwritex($$0471$i != $$0471$i | 0.0 != 0.0 ? ($389 ? 15323 : 15327) : $389 ? 15315 : 15319, 3, $0) | 0;
     _pad($0, 32, $$1260, $393, $$1263$ ^ 8192);
     $$0470$i = ($393 | 0) < ($$1260 | 0) ? $$1260 : $393;
    } while (0);
    $$0243 = $$0470$i;
    $$0247 = $$1248;
    $$0269 = $$3272;
    $$0321 = $158;
    continue L1;
    break;
   }
  default:
   {
    $$2 = $$0321;
    $$2234 = 0;
    $$2239 = 15279;
    $$2251 = $14;
    $$5 = $$0254;
    $$6268 = $$1263$;
   }
  } while (0);
  L310 : do if ((label | 0) == 63) {
   label = 0;
   $218 = $9;
   $220 = HEAP32[$218 >> 2] | 0;
   $223 = HEAP32[$218 + 4 >> 2] | 0;
   $224 = $$1236 & 32;
   if (($220 | 0) == 0 & ($223 | 0) == 0) {
    $$05$lcssa$i = $14;
    $248 = 0;
    $250 = 0;
   } else {
    $$056$i = $14;
    $229 = $220;
    $236 = $223;
    do {
     $$056$i = $$056$i + -1 | 0;
     HEAP8[$$056$i >> 0] = HEAPU8[15263 + ($229 & 15) >> 0] | $224;
     $229 = _bitshift64Lshr($229 | 0, $236 | 0, 4) | 0;
     $236 = tempRet0;
    } while (!(($229 | 0) == 0 & ($236 | 0) == 0));
    $242 = $9;
    $$05$lcssa$i = $$056$i;
    $248 = HEAP32[$242 >> 2] | 0;
    $250 = HEAP32[$242 + 4 >> 2] | 0;
   }
   $or$cond282 = ($$3265 & 8 | 0) == 0 | ($248 | 0) == 0 & ($250 | 0) == 0;
   $$0228 = $$05$lcssa$i;
   $$1233 = $or$cond282 ? 0 : 2;
   $$1238 = $or$cond282 ? 15279 : 15279 + ($$1236 >> 4) | 0;
   $$2256 = $$1255;
   $$4266 = $$3265;
   label = 76;
  } else if ((label | 0) == 75) {
   label = 0;
   $$0228 = _fmt_u($300, $301, $14) | 0;
   $$1233 = $$0232;
   $$1238 = $$0237;
   $$2256 = $$0254;
   $$4266 = $$1263$;
   label = 76;
  } else if ((label | 0) == 81) {
   label = 0;
   $334 = _memchr($$1, 0, $$0254) | 0;
   $335 = ($334 | 0) == 0;
   $$2 = $$1;
   $$2234 = 0;
   $$2239 = 15279;
   $$2251 = $335 ? $$1 + $$0254 | 0 : $334;
   $$5 = $335 ? $$0254 : $334 - $$1 | 0;
   $$6268 = $187;
  } else if ((label | 0) == 85) {
   label = 0;
   $$0229396 = $809;
   $$0240395 = 0;
   $$1244394 = 0;
   while (1) {
    $347 = HEAP32[$$0229396 >> 2] | 0;
    if (!$347) {
     $$0240$lcssa = $$0240395;
     $$2245 = $$1244394;
     break;
    }
    $349 = _wctomb($12, $347) | 0;
    if (($349 | 0) < 0 | $349 >>> 0 > ($$4258458 - $$0240395 | 0) >>> 0) {
     $$0240$lcssa = $$0240395;
     $$2245 = $349;
     break;
    }
    $354 = $349 + $$0240395 | 0;
    if ($$4258458 >>> 0 > $354 >>> 0) {
     $$0229396 = $$0229396 + 4 | 0;
     $$0240395 = $354;
     $$1244394 = $349;
    } else {
     $$0240$lcssa = $354;
     $$2245 = $349;
     break;
    }
   }
   if (($$2245 | 0) < 0) {
    $$0 = -1;
    break L1;
   }
   _pad($0, 32, $$1260, $$0240$lcssa, $$1263$);
   if (!$$0240$lcssa) {
    $$0240$lcssa460 = 0;
    label = 96;
   } else {
    $$1230407 = $809;
    $$1241406 = 0;
    while (1) {
     $358 = HEAP32[$$1230407 >> 2] | 0;
     if (!$358) {
      $$0240$lcssa460 = $$0240$lcssa;
      label = 96;
      break L310;
     }
     $361 = _wctomb($12, $358) | 0;
     $$1241406 = $361 + $$1241406 | 0;
     if (($$1241406 | 0) > ($$0240$lcssa | 0)) {
      $$0240$lcssa460 = $$0240$lcssa;
      label = 96;
      break L310;
     }
     if (!(HEAP32[$0 >> 2] & 32)) ___fwritex($12, $361, $0) | 0;
     if ($$1241406 >>> 0 >= $$0240$lcssa >>> 0) {
      $$0240$lcssa460 = $$0240$lcssa;
      label = 96;
      break;
     } else $$1230407 = $$1230407 + 4 | 0;
    }
   }
  } while (0);
  if ((label | 0) == 96) {
   label = 0;
   _pad($0, 32, $$1260, $$0240$lcssa460, $$1263$ ^ 8192);
   $$0243 = ($$1260 | 0) > ($$0240$lcssa460 | 0) ? $$1260 : $$0240$lcssa460;
   $$0247 = $$1248;
   $$0269 = $$3272;
   $$0321 = $158;
   continue;
  }
  if ((label | 0) == 76) {
   label = 0;
   $$$4266 = ($$2256 | 0) > -1 ? $$4266 & -65537 : $$4266;
   $305 = $9;
   $313 = (HEAP32[$305 >> 2] | 0) != 0 | (HEAP32[$305 + 4 >> 2] | 0) != 0;
   if (($$2256 | 0) != 0 | $313) {
    $319 = ($313 & 1 ^ 1) + ($15 - $$0228) | 0;
    $$2 = $$0228;
    $$2234 = $$1233;
    $$2239 = $$1238;
    $$2251 = $14;
    $$5 = ($$2256 | 0) > ($319 | 0) ? $$2256 : $319;
    $$6268 = $$$4266;
   } else {
    $$2 = $14;
    $$2234 = $$1233;
    $$2239 = $$1238;
    $$2251 = $14;
    $$5 = 0;
    $$6268 = $$$4266;
   }
  }
  $784 = $$2251 - $$2 | 0;
  $$$5 = ($$5 | 0) < ($784 | 0) ? $784 : $$5;
  $786 = $$$5 + $$2234 | 0;
  $$2261 = ($$1260 | 0) < ($786 | 0) ? $786 : $$1260;
  _pad($0, 32, $$2261, $786, $$6268);
  if (!(HEAP32[$0 >> 2] & 32)) ___fwritex($$2239, $$2234, $0) | 0;
  _pad($0, 48, $$2261, $786, $$6268 ^ 65536);
  _pad($0, 48, $$$5, $784, 0);
  if (!(HEAP32[$0 >> 2] & 32)) ___fwritex($$2, $784, $0) | 0;
  _pad($0, 32, $$2261, $786, $$6268 ^ 8192);
  $$0243 = $$2261;
  $$0247 = $$1248;
  $$0269 = $$3272;
  $$0321 = $158;
 }
 L345 : do if ((label | 0) == 243) if (!$0) if (!$$0269) $$0 = 0; else {
  $$2242381 = 1;
  while (1) {
   $799 = HEAP32[$4 + ($$2242381 << 2) >> 2] | 0;
   if (!$799) {
    $$3379 = $$2242381;
    break;
   }
   _pop_arg_588($3 + ($$2242381 << 3) | 0, $799, $2);
   $$2242381 = $$2242381 + 1 | 0;
   if (($$2242381 | 0) >= 10) {
    $$0 = 1;
    break L345;
   }
  }
  while (1) {
   if (HEAP32[$4 + ($$3379 << 2) >> 2] | 0) {
    $$0 = -1;
    break L345;
   }
   $$3379 = $$3379 + 1 | 0;
   if (($$3379 | 0) >= 10) {
    $$0 = 1;
    break;
   }
  }
 } else $$0 = $$1248; while (0);
 STACKTOP = sp;
 return $$0 | 0;
}

function _malloc($0) {
 $0 = $0 | 0;
 var $$$4349$i = 0, $$$i = 0, $$0 = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i17$i = 0, $$0$i18$i = 0, $$01$i$i = 0, $$0187$i = 0, $$0189$i = 0, $$0190$i = 0, $$0191$i = 0, $$0197 = 0, $$0199 = 0, $$0206$i$i = 0, $$0207$i$i = 0, $$0211$i$i = 0, $$0212$i$i = 0, $$024370$i = 0, $$0286$i$i = 0, $$0287$i$i = 0, $$0288$i$i = 0, $$0294$i$i = 0, $$0295$i$i = 0, $$0340$i = 0, $$0342$i = 0, $$0343$i = 0, $$0345$i = 0, $$0351$i = 0, $$0356$i = 0, $$0357$i = 0, $$0359$i = 0, $$0360$i = 0, $$0366$i = 0, $$1194$i = 0, $$1196$i = 0, $$124469$i = 0, $$1290$i$i = 0, $$1292$i$i = 0, $$1341$i = 0, $$1346$i = 0, $$1361$i = 0, $$1368$i = 0, $$1372$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2353$i = 0, $$3$i = 0, $$3$i$i = 0, $$3$i201 = 0, $$3348$i = 0, $$3370$i = 0, $$4$lcssa$i = 0, $$413$i = 0, $$4349$lcssa$i = 0, $$434912$i = 0, $$4355$$4$i = 0, $$4355$ph$i = 0, $$435511$i = 0, $$5256$i = 0, $$723947$i = 0, $$748$i = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i20$iZ2D = 0, $$pre$phi$i206Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi10$i$iZ2D = 0, $$pre$phiZ2D = 0, $1 = 0, $1004 = 0, $1007 = 0, $1008 = 0, $101 = 0, $102 = 0, $1026 = 0, $1028 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1045 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $108 = 0, $112 = 0, $114 = 0, $115 = 0, $117 = 0, $119 = 0, $121 = 0, $123 = 0, $125 = 0, $127 = 0, $129 = 0, $134 = 0, $14 = 0, $140 = 0, $143 = 0, $146 = 0, $149 = 0, $150 = 0, $151 = 0, $153 = 0, $156 = 0, $158 = 0, $16 = 0, $161 = 0, $163 = 0, $166 = 0, $169 = 0, $17 = 0, $170 = 0, $172 = 0, $173 = 0, $175 = 0, $176 = 0, $178 = 0, $179 = 0, $18 = 0, $184 = 0, $185 = 0, $19 = 0, $193 = 0, $198 = 0, $20 = 0, $202 = 0, $208 = 0, $215 = 0, $219 = 0, $228 = 0, $229 = 0, $231 = 0, $232 = 0, $236 = 0, $237 = 0, $245 = 0, $246 = 0, $247 = 0, $249 = 0, $250 = 0, $255 = 0, $256 = 0, $259 = 0, $261 = 0, $264 = 0, $269 = 0, $27 = 0, $276 = 0, $286 = 0, $290 = 0, $296 = 0, $30 = 0, $301 = 0, $304 = 0, $308 = 0, $310 = 0, $311 = 0, $313 = 0, $315 = 0, $317 = 0, $319 = 0, $321 = 0, $323 = 0, $325 = 0, $335 = 0, $336 = 0, $338 = 0, $34 = 0, $347 = 0, $349 = 0, $352 = 0, $354 = 0, $357 = 0, $359 = 0, $362 = 0, $365 = 0, $366 = 0, $368 = 0, $369 = 0, $37 = 0, $371 = 0, $372 = 0, $374 = 0, $375 = 0, $380 = 0, $381 = 0, $386 = 0, $389 = 0, $394 = 0, $398 = 0, $404 = 0, $41 = 0, $411 = 0, $415 = 0, $423 = 0, $426 = 0, $427 = 0, $428 = 0, $432 = 0, $433 = 0, $439 = 0, $44 = 0, $444 = 0, $445 = 0, $448 = 0, $450 = 0, $453 = 0, $458 = 0, $464 = 0, $466 = 0, $468 = 0, $47 = 0, $470 = 0, $487 = 0, $489 = 0, $49 = 0, $496 = 0, $497 = 0, $498 = 0, $50 = 0, $506 = 0, $508 = 0, $509 = 0, $511 = 0, $52 = 0, $520 = 0, $524 = 0, $526 = 0, $527 = 0, $528 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $546 = 0, $548 = 0, $549 = 0, $555 = 0, $557 = 0, $559 = 0, $56 = 0, $564 = 0, $566 = 0, $568 = 0, $569 = 0, $570 = 0, $578 = 0, $579 = 0, $58 = 0, $582 = 0, $586 = 0, $589 = 0, $591 = 0, $597 = 0, $6 = 0, $60 = 0, $601 = 0, $605 = 0, $614 = 0, $615 = 0, $62 = 0, $621 = 0, $624 = 0, $627 = 0, $629 = 0, $634 = 0, $64 = 0, $640 = 0, $645 = 0, $646 = 0, $647 = 0, $653 = 0, $654 = 0, $655 = 0, $659 = 0, $67 = 0, $670 = 0, $675 = 0, $676 = 0, $678 = 0, $684 = 0, $686 = 0, $69 = 0, $690 = 0, $696 = 0, $7 = 0, $70 = 0, $700 = 0, $706 = 0, $708 = 0, $71 = 0, $714 = 0, $718 = 0, $719 = 0, $72 = 0, $724 = 0, $73 = 0, $730 = 0, $735 = 0, $738 = 0, $739 = 0, $742 = 0, $744 = 0, $746 = 0, $749 = 0, $760 = 0, $765 = 0, $767 = 0, $77 = 0, $770 = 0, $772 = 0, $775 = 0, $778 = 0, $779 = 0, $780 = 0, $782 = 0, $784 = 0, $785 = 0, $787 = 0, $788 = 0, $793 = 0, $794 = 0, $8 = 0, $80 = 0, $803 = 0, $808 = 0, $811 = 0, $812 = 0, $818 = 0, $826 = 0, $832 = 0, $835 = 0, $836 = 0, $837 = 0, $84 = 0, $841 = 0, $842 = 0, $848 = 0, $853 = 0, $854 = 0, $857 = 0, $859 = 0, $862 = 0, $867 = 0, $87 = 0, $873 = 0, $875 = 0, $877 = 0, $878 = 0, $896 = 0, $898 = 0, $9 = 0, $905 = 0, $906 = 0, $907 = 0, $914 = 0, $918 = 0, $92 = 0, $922 = 0, $924 = 0, $93 = 0, $930 = 0, $931 = 0, $933 = 0, $934 = 0, $938 = 0, $943 = 0, $944 = 0, $945 = 0, $95 = 0, $951 = 0, $958 = 0, $96 = 0, $963 = 0, $966 = 0, $967 = 0, $968 = 0, $972 = 0, $973 = 0, $979 = 0, $98 = 0, $984 = 0, $985 = 0, $988 = 0, $990 = 0, $993 = 0, $998 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $1 = sp;
 do if ($0 >>> 0 < 245) {
  $6 = $0 >>> 0 < 11 ? 16 : $0 + 11 & -8;
  $7 = $6 >>> 3;
  $8 = HEAP32[4521] | 0;
  $9 = $8 >>> $7;
  if ($9 & 3 | 0) {
   $14 = ($9 & 1 ^ 1) + $7 | 0;
   $16 = 18124 + ($14 << 1 << 2) | 0;
   $17 = $16 + 8 | 0;
   $18 = HEAP32[$17 >> 2] | 0;
   $19 = $18 + 8 | 0;
   $20 = HEAP32[$19 >> 2] | 0;
   do if (($16 | 0) == ($20 | 0)) HEAP32[4521] = $8 & ~(1 << $14); else {
    if ($20 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort();
    $27 = $20 + 12 | 0;
    if ((HEAP32[$27 >> 2] | 0) == ($18 | 0)) {
     HEAP32[$27 >> 2] = $16;
     HEAP32[$17 >> 2] = $20;
     break;
    } else _abort();
   } while (0);
   $30 = $14 << 3;
   HEAP32[$18 + 4 >> 2] = $30 | 3;
   $34 = $18 + $30 + 4 | 0;
   HEAP32[$34 >> 2] = HEAP32[$34 >> 2] | 1;
   $$0 = $19;
   STACKTOP = sp;
   return $$0 | 0;
  }
  $37 = HEAP32[4523] | 0;
  if ($6 >>> 0 > $37 >>> 0) {
   if ($9 | 0) {
    $41 = 2 << $7;
    $44 = $9 << $7 & ($41 | 0 - $41);
    $47 = ($44 & 0 - $44) + -1 | 0;
    $49 = $47 >>> 12 & 16;
    $50 = $47 >>> $49;
    $52 = $50 >>> 5 & 8;
    $54 = $50 >>> $52;
    $56 = $54 >>> 2 & 4;
    $58 = $54 >>> $56;
    $60 = $58 >>> 1 & 2;
    $62 = $58 >>> $60;
    $64 = $62 >>> 1 & 1;
    $67 = ($52 | $49 | $56 | $60 | $64) + ($62 >>> $64) | 0;
    $69 = 18124 + ($67 << 1 << 2) | 0;
    $70 = $69 + 8 | 0;
    $71 = HEAP32[$70 >> 2] | 0;
    $72 = $71 + 8 | 0;
    $73 = HEAP32[$72 >> 2] | 0;
    do if (($69 | 0) == ($73 | 0)) {
     $77 = $8 & ~(1 << $67);
     HEAP32[4521] = $77;
     $98 = $77;
    } else {
     if ($73 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort();
     $80 = $73 + 12 | 0;
     if ((HEAP32[$80 >> 2] | 0) == ($71 | 0)) {
      HEAP32[$80 >> 2] = $69;
      HEAP32[$70 >> 2] = $73;
      $98 = $8;
      break;
     } else _abort();
    } while (0);
    $84 = ($67 << 3) - $6 | 0;
    HEAP32[$71 + 4 >> 2] = $6 | 3;
    $87 = $71 + $6 | 0;
    HEAP32[$87 + 4 >> 2] = $84 | 1;
    HEAP32[$87 + $84 >> 2] = $84;
    if ($37 | 0) {
     $92 = HEAP32[4526] | 0;
     $93 = $37 >>> 3;
     $95 = 18124 + ($93 << 1 << 2) | 0;
     $96 = 1 << $93;
     if (!($98 & $96)) {
      HEAP32[4521] = $98 | $96;
      $$0199 = $95;
      $$pre$phiZ2D = $95 + 8 | 0;
     } else {
      $101 = $95 + 8 | 0;
      $102 = HEAP32[$101 >> 2] | 0;
      if ($102 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
       $$0199 = $102;
       $$pre$phiZ2D = $101;
      }
     }
     HEAP32[$$pre$phiZ2D >> 2] = $92;
     HEAP32[$$0199 + 12 >> 2] = $92;
     HEAP32[$92 + 8 >> 2] = $$0199;
     HEAP32[$92 + 12 >> 2] = $95;
    }
    HEAP32[4523] = $84;
    HEAP32[4526] = $87;
    $$0 = $72;
    STACKTOP = sp;
    return $$0 | 0;
   }
   $108 = HEAP32[4522] | 0;
   if (!$108) $$0197 = $6; else {
    $112 = ($108 & 0 - $108) + -1 | 0;
    $114 = $112 >>> 12 & 16;
    $115 = $112 >>> $114;
    $117 = $115 >>> 5 & 8;
    $119 = $115 >>> $117;
    $121 = $119 >>> 2 & 4;
    $123 = $119 >>> $121;
    $125 = $123 >>> 1 & 2;
    $127 = $123 >>> $125;
    $129 = $127 >>> 1 & 1;
    $134 = HEAP32[18388 + (($117 | $114 | $121 | $125 | $129) + ($127 >>> $129) << 2) >> 2] | 0;
    $$0189$i = $134;
    $$0190$i = $134;
    $$0191$i = (HEAP32[$134 + 4 >> 2] & -8) - $6 | 0;
    while (1) {
     $140 = HEAP32[$$0189$i + 16 >> 2] | 0;
     if (!$140) {
      $143 = HEAP32[$$0189$i + 20 >> 2] | 0;
      if (!$143) break; else $146 = $143;
     } else $146 = $140;
     $149 = (HEAP32[$146 + 4 >> 2] & -8) - $6 | 0;
     $150 = $149 >>> 0 < $$0191$i >>> 0;
     $$0189$i = $146;
     $$0190$i = $150 ? $146 : $$0190$i;
     $$0191$i = $150 ? $149 : $$0191$i;
    }
    $151 = HEAP32[4525] | 0;
    if ($$0190$i >>> 0 < $151 >>> 0) _abort();
    $153 = $$0190$i + $6 | 0;
    if ($$0190$i >>> 0 >= $153 >>> 0) _abort();
    $156 = HEAP32[$$0190$i + 24 >> 2] | 0;
    $158 = HEAP32[$$0190$i + 12 >> 2] | 0;
    do if (($158 | 0) == ($$0190$i | 0)) {
     $169 = $$0190$i + 20 | 0;
     $170 = HEAP32[$169 >> 2] | 0;
     if (!$170) {
      $172 = $$0190$i + 16 | 0;
      $173 = HEAP32[$172 >> 2] | 0;
      if (!$173) {
       $$3$i = 0;
       break;
      } else {
       $$1194$i = $173;
       $$1196$i = $172;
      }
     } else {
      $$1194$i = $170;
      $$1196$i = $169;
     }
     while (1) {
      $175 = $$1194$i + 20 | 0;
      $176 = HEAP32[$175 >> 2] | 0;
      if ($176 | 0) {
       $$1194$i = $176;
       $$1196$i = $175;
       continue;
      }
      $178 = $$1194$i + 16 | 0;
      $179 = HEAP32[$178 >> 2] | 0;
      if (!$179) break; else {
       $$1194$i = $179;
       $$1196$i = $178;
      }
     }
     if ($$1196$i >>> 0 < $151 >>> 0) _abort(); else {
      HEAP32[$$1196$i >> 2] = 0;
      $$3$i = $$1194$i;
      break;
     }
    } else {
     $161 = HEAP32[$$0190$i + 8 >> 2] | 0;
     if ($161 >>> 0 < $151 >>> 0) _abort();
     $163 = $161 + 12 | 0;
     if ((HEAP32[$163 >> 2] | 0) != ($$0190$i | 0)) _abort();
     $166 = $158 + 8 | 0;
     if ((HEAP32[$166 >> 2] | 0) == ($$0190$i | 0)) {
      HEAP32[$163 >> 2] = $158;
      HEAP32[$166 >> 2] = $161;
      $$3$i = $158;
      break;
     } else _abort();
    } while (0);
    do if ($156 | 0) {
     $184 = HEAP32[$$0190$i + 28 >> 2] | 0;
     $185 = 18388 + ($184 << 2) | 0;
     if (($$0190$i | 0) == (HEAP32[$185 >> 2] | 0)) {
      HEAP32[$185 >> 2] = $$3$i;
      if (!$$3$i) {
       HEAP32[4522] = $108 & ~(1 << $184);
       break;
      }
     } else {
      if ($156 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort();
      $193 = $156 + 16 | 0;
      if ((HEAP32[$193 >> 2] | 0) == ($$0190$i | 0)) HEAP32[$193 >> 2] = $$3$i; else HEAP32[$156 + 20 >> 2] = $$3$i;
      if (!$$3$i) break;
     }
     $198 = HEAP32[4525] | 0;
     if ($$3$i >>> 0 < $198 >>> 0) _abort();
     HEAP32[$$3$i + 24 >> 2] = $156;
     $202 = HEAP32[$$0190$i + 16 >> 2] | 0;
     do if ($202 | 0) if ($202 >>> 0 < $198 >>> 0) _abort(); else {
      HEAP32[$$3$i + 16 >> 2] = $202;
      HEAP32[$202 + 24 >> 2] = $$3$i;
      break;
     } while (0);
     $208 = HEAP32[$$0190$i + 20 >> 2] | 0;
     if ($208 | 0) if ($208 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
      HEAP32[$$3$i + 20 >> 2] = $208;
      HEAP32[$208 + 24 >> 2] = $$3$i;
      break;
     }
    } while (0);
    if ($$0191$i >>> 0 < 16) {
     $215 = $$0191$i + $6 | 0;
     HEAP32[$$0190$i + 4 >> 2] = $215 | 3;
     $219 = $$0190$i + $215 + 4 | 0;
     HEAP32[$219 >> 2] = HEAP32[$219 >> 2] | 1;
    } else {
     HEAP32[$$0190$i + 4 >> 2] = $6 | 3;
     HEAP32[$153 + 4 >> 2] = $$0191$i | 1;
     HEAP32[$153 + $$0191$i >> 2] = $$0191$i;
     if ($37 | 0) {
      $228 = HEAP32[4526] | 0;
      $229 = $37 >>> 3;
      $231 = 18124 + ($229 << 1 << 2) | 0;
      $232 = 1 << $229;
      if (!($8 & $232)) {
       HEAP32[4521] = $8 | $232;
       $$0187$i = $231;
       $$pre$phi$iZ2D = $231 + 8 | 0;
      } else {
       $236 = $231 + 8 | 0;
       $237 = HEAP32[$236 >> 2] | 0;
       if ($237 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
        $$0187$i = $237;
        $$pre$phi$iZ2D = $236;
       }
      }
      HEAP32[$$pre$phi$iZ2D >> 2] = $228;
      HEAP32[$$0187$i + 12 >> 2] = $228;
      HEAP32[$228 + 8 >> 2] = $$0187$i;
      HEAP32[$228 + 12 >> 2] = $231;
     }
     HEAP32[4523] = $$0191$i;
     HEAP32[4526] = $153;
    }
    $$0 = $$0190$i + 8 | 0;
    STACKTOP = sp;
    return $$0 | 0;
   }
  } else $$0197 = $6;
 } else if ($0 >>> 0 > 4294967231) $$0197 = -1; else {
  $245 = $0 + 11 | 0;
  $246 = $245 & -8;
  $247 = HEAP32[4522] | 0;
  if (!$247) $$0197 = $246; else {
   $249 = 0 - $246 | 0;
   $250 = $245 >>> 8;
   if (!$250) $$0356$i = 0; else if ($246 >>> 0 > 16777215) $$0356$i = 31; else {
    $255 = ($250 + 1048320 | 0) >>> 16 & 8;
    $256 = $250 << $255;
    $259 = ($256 + 520192 | 0) >>> 16 & 4;
    $261 = $256 << $259;
    $264 = ($261 + 245760 | 0) >>> 16 & 2;
    $269 = 14 - ($259 | $255 | $264) + ($261 << $264 >>> 15) | 0;
    $$0356$i = $246 >>> ($269 + 7 | 0) & 1 | $269 << 1;
   }
   $276 = HEAP32[18388 + ($$0356$i << 2) >> 2] | 0;
   L123 : do if (!$276) {
    $$2353$i = 0;
    $$3$i201 = 0;
    $$3348$i = $249;
    label = 86;
   } else {
    $$0340$i = 0;
    $$0345$i = $249;
    $$0351$i = $276;
    $$0357$i = $246 << (($$0356$i | 0) == 31 ? 0 : 25 - ($$0356$i >>> 1) | 0);
    $$0360$i = 0;
    while (1) {
     $286 = (HEAP32[$$0351$i + 4 >> 2] & -8) - $246 | 0;
     if ($286 >>> 0 < $$0345$i >>> 0) if (!$286) {
      $$413$i = $$0351$i;
      $$434912$i = 0;
      $$435511$i = $$0351$i;
      label = 90;
      break L123;
     } else {
      $$1341$i = $$0351$i;
      $$1346$i = $286;
     } else {
      $$1341$i = $$0340$i;
      $$1346$i = $$0345$i;
     }
     $290 = HEAP32[$$0351$i + 20 >> 2] | 0;
     $$0351$i = HEAP32[$$0351$i + 16 + ($$0357$i >>> 31 << 2) >> 2] | 0;
     $$1361$i = ($290 | 0) == 0 | ($290 | 0) == ($$0351$i | 0) ? $$0360$i : $290;
     $296 = ($$0351$i | 0) == 0;
     if ($296) {
      $$2353$i = $$1361$i;
      $$3$i201 = $$1341$i;
      $$3348$i = $$1346$i;
      label = 86;
      break;
     } else {
      $$0340$i = $$1341$i;
      $$0345$i = $$1346$i;
      $$0357$i = $$0357$i << ($296 & 1 ^ 1);
      $$0360$i = $$1361$i;
     }
    }
   } while (0);
   if ((label | 0) == 86) {
    if (($$2353$i | 0) == 0 & ($$3$i201 | 0) == 0) {
     $301 = 2 << $$0356$i;
     $304 = $247 & ($301 | 0 - $301);
     if (!$304) {
      $$0197 = $246;
      break;
     }
     $308 = ($304 & 0 - $304) + -1 | 0;
     $310 = $308 >>> 12 & 16;
     $311 = $308 >>> $310;
     $313 = $311 >>> 5 & 8;
     $315 = $311 >>> $313;
     $317 = $315 >>> 2 & 4;
     $319 = $315 >>> $317;
     $321 = $319 >>> 1 & 2;
     $323 = $319 >>> $321;
     $325 = $323 >>> 1 & 1;
     $$4355$ph$i = HEAP32[18388 + (($313 | $310 | $317 | $321 | $325) + ($323 >>> $325) << 2) >> 2] | 0;
    } else $$4355$ph$i = $$2353$i;
    if (!$$4355$ph$i) {
     $$4$lcssa$i = $$3$i201;
     $$4349$lcssa$i = $$3348$i;
    } else {
     $$413$i = $$3$i201;
     $$434912$i = $$3348$i;
     $$435511$i = $$4355$ph$i;
     label = 90;
    }
   }
   if ((label | 0) == 90) while (1) {
    label = 0;
    $335 = (HEAP32[$$435511$i + 4 >> 2] & -8) - $246 | 0;
    $336 = $335 >>> 0 < $$434912$i >>> 0;
    $$$4349$i = $336 ? $335 : $$434912$i;
    $$4355$$4$i = $336 ? $$435511$i : $$413$i;
    $338 = HEAP32[$$435511$i + 16 >> 2] | 0;
    if ($338 | 0) {
     $$413$i = $$4355$$4$i;
     $$434912$i = $$$4349$i;
     $$435511$i = $338;
     label = 90;
     continue;
    }
    $$435511$i = HEAP32[$$435511$i + 20 >> 2] | 0;
    if (!$$435511$i) {
     $$4$lcssa$i = $$4355$$4$i;
     $$4349$lcssa$i = $$$4349$i;
     break;
    } else {
     $$413$i = $$4355$$4$i;
     $$434912$i = $$$4349$i;
     label = 90;
    }
   }
   if (!$$4$lcssa$i) $$0197 = $246; else if ($$4349$lcssa$i >>> 0 < ((HEAP32[4523] | 0) - $246 | 0) >>> 0) {
    $347 = HEAP32[4525] | 0;
    if ($$4$lcssa$i >>> 0 < $347 >>> 0) _abort();
    $349 = $$4$lcssa$i + $246 | 0;
    if ($$4$lcssa$i >>> 0 >= $349 >>> 0) _abort();
    $352 = HEAP32[$$4$lcssa$i + 24 >> 2] | 0;
    $354 = HEAP32[$$4$lcssa$i + 12 >> 2] | 0;
    do if (($354 | 0) == ($$4$lcssa$i | 0)) {
     $365 = $$4$lcssa$i + 20 | 0;
     $366 = HEAP32[$365 >> 2] | 0;
     if (!$366) {
      $368 = $$4$lcssa$i + 16 | 0;
      $369 = HEAP32[$368 >> 2] | 0;
      if (!$369) {
       $$3370$i = 0;
       break;
      } else {
       $$1368$i = $369;
       $$1372$i = $368;
      }
     } else {
      $$1368$i = $366;
      $$1372$i = $365;
     }
     while (1) {
      $371 = $$1368$i + 20 | 0;
      $372 = HEAP32[$371 >> 2] | 0;
      if ($372 | 0) {
       $$1368$i = $372;
       $$1372$i = $371;
       continue;
      }
      $374 = $$1368$i + 16 | 0;
      $375 = HEAP32[$374 >> 2] | 0;
      if (!$375) break; else {
       $$1368$i = $375;
       $$1372$i = $374;
      }
     }
     if ($$1372$i >>> 0 < $347 >>> 0) _abort(); else {
      HEAP32[$$1372$i >> 2] = 0;
      $$3370$i = $$1368$i;
      break;
     }
    } else {
     $357 = HEAP32[$$4$lcssa$i + 8 >> 2] | 0;
     if ($357 >>> 0 < $347 >>> 0) _abort();
     $359 = $357 + 12 | 0;
     if ((HEAP32[$359 >> 2] | 0) != ($$4$lcssa$i | 0)) _abort();
     $362 = $354 + 8 | 0;
     if ((HEAP32[$362 >> 2] | 0) == ($$4$lcssa$i | 0)) {
      HEAP32[$359 >> 2] = $354;
      HEAP32[$362 >> 2] = $357;
      $$3370$i = $354;
      break;
     } else _abort();
    } while (0);
    do if (!$352) $470 = $247; else {
     $380 = HEAP32[$$4$lcssa$i + 28 >> 2] | 0;
     $381 = 18388 + ($380 << 2) | 0;
     if (($$4$lcssa$i | 0) == (HEAP32[$381 >> 2] | 0)) {
      HEAP32[$381 >> 2] = $$3370$i;
      if (!$$3370$i) {
       $386 = $247 & ~(1 << $380);
       HEAP32[4522] = $386;
       $470 = $386;
       break;
      }
     } else {
      if ($352 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort();
      $389 = $352 + 16 | 0;
      if ((HEAP32[$389 >> 2] | 0) == ($$4$lcssa$i | 0)) HEAP32[$389 >> 2] = $$3370$i; else HEAP32[$352 + 20 >> 2] = $$3370$i;
      if (!$$3370$i) {
       $470 = $247;
       break;
      }
     }
     $394 = HEAP32[4525] | 0;
     if ($$3370$i >>> 0 < $394 >>> 0) _abort();
     HEAP32[$$3370$i + 24 >> 2] = $352;
     $398 = HEAP32[$$4$lcssa$i + 16 >> 2] | 0;
     do if ($398 | 0) if ($398 >>> 0 < $394 >>> 0) _abort(); else {
      HEAP32[$$3370$i + 16 >> 2] = $398;
      HEAP32[$398 + 24 >> 2] = $$3370$i;
      break;
     } while (0);
     $404 = HEAP32[$$4$lcssa$i + 20 >> 2] | 0;
     if (!$404) $470 = $247; else if ($404 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
      HEAP32[$$3370$i + 20 >> 2] = $404;
      HEAP32[$404 + 24 >> 2] = $$3370$i;
      $470 = $247;
      break;
     }
    } while (0);
    do if ($$4349$lcssa$i >>> 0 < 16) {
     $411 = $$4349$lcssa$i + $246 | 0;
     HEAP32[$$4$lcssa$i + 4 >> 2] = $411 | 3;
     $415 = $$4$lcssa$i + $411 + 4 | 0;
     HEAP32[$415 >> 2] = HEAP32[$415 >> 2] | 1;
    } else {
     HEAP32[$$4$lcssa$i + 4 >> 2] = $246 | 3;
     HEAP32[$349 + 4 >> 2] = $$4349$lcssa$i | 1;
     HEAP32[$349 + $$4349$lcssa$i >> 2] = $$4349$lcssa$i;
     $423 = $$4349$lcssa$i >>> 3;
     if ($$4349$lcssa$i >>> 0 < 256) {
      $426 = 18124 + ($423 << 1 << 2) | 0;
      $427 = HEAP32[4521] | 0;
      $428 = 1 << $423;
      if (!($427 & $428)) {
       HEAP32[4521] = $427 | $428;
       $$0366$i = $426;
       $$pre$phi$i206Z2D = $426 + 8 | 0;
      } else {
       $432 = $426 + 8 | 0;
       $433 = HEAP32[$432 >> 2] | 0;
       if ($433 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
        $$0366$i = $433;
        $$pre$phi$i206Z2D = $432;
       }
      }
      HEAP32[$$pre$phi$i206Z2D >> 2] = $349;
      HEAP32[$$0366$i + 12 >> 2] = $349;
      HEAP32[$349 + 8 >> 2] = $$0366$i;
      HEAP32[$349 + 12 >> 2] = $426;
      break;
     }
     $439 = $$4349$lcssa$i >>> 8;
     if (!$439) $$0359$i = 0; else if ($$4349$lcssa$i >>> 0 > 16777215) $$0359$i = 31; else {
      $444 = ($439 + 1048320 | 0) >>> 16 & 8;
      $445 = $439 << $444;
      $448 = ($445 + 520192 | 0) >>> 16 & 4;
      $450 = $445 << $448;
      $453 = ($450 + 245760 | 0) >>> 16 & 2;
      $458 = 14 - ($448 | $444 | $453) + ($450 << $453 >>> 15) | 0;
      $$0359$i = $$4349$lcssa$i >>> ($458 + 7 | 0) & 1 | $458 << 1;
     }
     $464 = 18388 + ($$0359$i << 2) | 0;
     HEAP32[$349 + 28 >> 2] = $$0359$i;
     $466 = $349 + 16 | 0;
     HEAP32[$466 + 4 >> 2] = 0;
     HEAP32[$466 >> 2] = 0;
     $468 = 1 << $$0359$i;
     if (!($470 & $468)) {
      HEAP32[4522] = $470 | $468;
      HEAP32[$464 >> 2] = $349;
      HEAP32[$349 + 24 >> 2] = $464;
      HEAP32[$349 + 12 >> 2] = $349;
      HEAP32[$349 + 8 >> 2] = $349;
      break;
     }
     $$0342$i = $$4349$lcssa$i << (($$0359$i | 0) == 31 ? 0 : 25 - ($$0359$i >>> 1) | 0);
     $$0343$i = HEAP32[$464 >> 2] | 0;
     while (1) {
      if ((HEAP32[$$0343$i + 4 >> 2] & -8 | 0) == ($$4349$lcssa$i | 0)) {
       label = 148;
       break;
      }
      $487 = $$0343$i + 16 + ($$0342$i >>> 31 << 2) | 0;
      $489 = HEAP32[$487 >> 2] | 0;
      if (!$489) {
       label = 145;
       break;
      } else {
       $$0342$i = $$0342$i << 1;
       $$0343$i = $489;
      }
     }
     if ((label | 0) == 145) if ($487 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
      HEAP32[$487 >> 2] = $349;
      HEAP32[$349 + 24 >> 2] = $$0343$i;
      HEAP32[$349 + 12 >> 2] = $349;
      HEAP32[$349 + 8 >> 2] = $349;
      break;
     } else if ((label | 0) == 148) {
      $496 = $$0343$i + 8 | 0;
      $497 = HEAP32[$496 >> 2] | 0;
      $498 = HEAP32[4525] | 0;
      if ($497 >>> 0 >= $498 >>> 0 & $$0343$i >>> 0 >= $498 >>> 0) {
       HEAP32[$497 + 12 >> 2] = $349;
       HEAP32[$496 >> 2] = $349;
       HEAP32[$349 + 8 >> 2] = $497;
       HEAP32[$349 + 12 >> 2] = $$0343$i;
       HEAP32[$349 + 24 >> 2] = 0;
       break;
      } else _abort();
     }
    } while (0);
    $$0 = $$4$lcssa$i + 8 | 0;
    STACKTOP = sp;
    return $$0 | 0;
   } else $$0197 = $246;
  }
 } while (0);
 $506 = HEAP32[4523] | 0;
 if ($506 >>> 0 >= $$0197 >>> 0) {
  $508 = $506 - $$0197 | 0;
  $509 = HEAP32[4526] | 0;
  if ($508 >>> 0 > 15) {
   $511 = $509 + $$0197 | 0;
   HEAP32[4526] = $511;
   HEAP32[4523] = $508;
   HEAP32[$511 + 4 >> 2] = $508 | 1;
   HEAP32[$511 + $508 >> 2] = $508;
   HEAP32[$509 + 4 >> 2] = $$0197 | 3;
  } else {
   HEAP32[4523] = 0;
   HEAP32[4526] = 0;
   HEAP32[$509 + 4 >> 2] = $506 | 3;
   $520 = $509 + $506 + 4 | 0;
   HEAP32[$520 >> 2] = HEAP32[$520 >> 2] | 1;
  }
  $$0 = $509 + 8 | 0;
  STACKTOP = sp;
  return $$0 | 0;
 }
 $524 = HEAP32[4524] | 0;
 if ($524 >>> 0 > $$0197 >>> 0) {
  $526 = $524 - $$0197 | 0;
  HEAP32[4524] = $526;
  $527 = HEAP32[4527] | 0;
  $528 = $527 + $$0197 | 0;
  HEAP32[4527] = $528;
  HEAP32[$528 + 4 >> 2] = $526 | 1;
  HEAP32[$527 + 4 >> 2] = $$0197 | 3;
  $$0 = $527 + 8 | 0;
  STACKTOP = sp;
  return $$0 | 0;
 }
 if (!(HEAP32[4639] | 0)) {
  HEAP32[4641] = 4096;
  HEAP32[4640] = 4096;
  HEAP32[4642] = -1;
  HEAP32[4643] = -1;
  HEAP32[4644] = 0;
  HEAP32[4632] = 0;
  $538 = $1 & -16 ^ 1431655768;
  HEAP32[$1 >> 2] = $538;
  HEAP32[4639] = $538;
  $542 = 4096;
 } else $542 = HEAP32[4641] | 0;
 $539 = $$0197 + 48 | 0;
 $540 = $$0197 + 47 | 0;
 $541 = $542 + $540 | 0;
 $543 = 0 - $542 | 0;
 $544 = $541 & $543;
 if ($544 >>> 0 <= $$0197 >>> 0) {
  $$0 = 0;
  STACKTOP = sp;
  return $$0 | 0;
 }
 $546 = HEAP32[4631] | 0;
 if ($546 | 0) {
  $548 = HEAP32[4629] | 0;
  $549 = $548 + $544 | 0;
  if ($549 >>> 0 <= $548 >>> 0 | $549 >>> 0 > $546 >>> 0) {
   $$0 = 0;
   STACKTOP = sp;
   return $$0 | 0;
  }
 }
 L255 : do if (!(HEAP32[4632] & 4)) {
  $555 = HEAP32[4527] | 0;
  L257 : do if (!$555) label = 172; else {
   $$0$i17$i = 18532;
   while (1) {
    $557 = HEAP32[$$0$i17$i >> 2] | 0;
    if ($557 >>> 0 <= $555 >>> 0) {
     $559 = $$0$i17$i + 4 | 0;
     if (($557 + (HEAP32[$559 >> 2] | 0) | 0) >>> 0 > $555 >>> 0) break;
    }
    $564 = HEAP32[$$0$i17$i + 8 >> 2] | 0;
    if (!$564) {
     label = 172;
     break L257;
    } else $$0$i17$i = $564;
   }
   $589 = $541 - $524 & $543;
   if ($589 >>> 0 < 2147483647) {
    $591 = _sbrk($589 | 0) | 0;
    if (($591 | 0) == ((HEAP32[$$0$i17$i >> 2] | 0) + (HEAP32[$559 >> 2] | 0) | 0)) {
     if (($591 | 0) != (-1 | 0)) {
      $$723947$i = $589;
      $$748$i = $591;
      label = 190;
      break L255;
     }
    } else {
     $$2247$ph$i = $591;
     $$2253$ph$i = $589;
     label = 180;
    }
   }
  } while (0);
  do if ((label | 0) == 172) {
   $566 = _sbrk(0) | 0;
   if (($566 | 0) != (-1 | 0)) {
    $568 = $566;
    $569 = HEAP32[4640] | 0;
    $570 = $569 + -1 | 0;
    $$$i = (($570 & $568 | 0) == 0 ? 0 : ($570 + $568 & 0 - $569) - $568 | 0) + $544 | 0;
    $578 = HEAP32[4629] | 0;
    $579 = $$$i + $578 | 0;
    if ($$$i >>> 0 > $$0197 >>> 0 & $$$i >>> 0 < 2147483647) {
     $582 = HEAP32[4631] | 0;
     if ($582 | 0) if ($579 >>> 0 <= $578 >>> 0 | $579 >>> 0 > $582 >>> 0) break;
     $586 = _sbrk($$$i | 0) | 0;
     if (($586 | 0) == ($566 | 0)) {
      $$723947$i = $$$i;
      $$748$i = $566;
      label = 190;
      break L255;
     } else {
      $$2247$ph$i = $586;
      $$2253$ph$i = $$$i;
      label = 180;
     }
    }
   }
  } while (0);
  L274 : do if ((label | 0) == 180) {
   $597 = 0 - $$2253$ph$i | 0;
   do if ($539 >>> 0 > $$2253$ph$i >>> 0 & ($$2253$ph$i >>> 0 < 2147483647 & ($$2247$ph$i | 0) != (-1 | 0))) {
    $601 = HEAP32[4641] | 0;
    $605 = $540 - $$2253$ph$i + $601 & 0 - $601;
    if ($605 >>> 0 < 2147483647) if ((_sbrk($605 | 0) | 0) == (-1 | 0)) {
     _sbrk($597 | 0) | 0;
     break L274;
    } else {
     $$5256$i = $605 + $$2253$ph$i | 0;
     break;
    } else $$5256$i = $$2253$ph$i;
   } else $$5256$i = $$2253$ph$i; while (0);
   if (($$2247$ph$i | 0) != (-1 | 0)) {
    $$723947$i = $$5256$i;
    $$748$i = $$2247$ph$i;
    label = 190;
    break L255;
   }
  } while (0);
  HEAP32[4632] = HEAP32[4632] | 4;
  label = 187;
 } else label = 187; while (0);
 if ((label | 0) == 187) if ($544 >>> 0 < 2147483647) {
  $614 = _sbrk($544 | 0) | 0;
  $615 = _sbrk(0) | 0;
  if ($614 >>> 0 < $615 >>> 0 & (($614 | 0) != (-1 | 0) & ($615 | 0) != (-1 | 0))) {
   $621 = $615 - $614 | 0;
   if ($621 >>> 0 > ($$0197 + 40 | 0) >>> 0) {
    $$723947$i = $621;
    $$748$i = $614;
    label = 190;
   }
  }
 }
 if ((label | 0) == 190) {
  $624 = (HEAP32[4629] | 0) + $$723947$i | 0;
  HEAP32[4629] = $624;
  if ($624 >>> 0 > (HEAP32[4630] | 0) >>> 0) HEAP32[4630] = $624;
  $627 = HEAP32[4527] | 0;
  do if (!$627) {
   $629 = HEAP32[4525] | 0;
   if (($629 | 0) == 0 | $$748$i >>> 0 < $629 >>> 0) HEAP32[4525] = $$748$i;
   HEAP32[4633] = $$748$i;
   HEAP32[4634] = $$723947$i;
   HEAP32[4636] = 0;
   HEAP32[4530] = HEAP32[4639];
   HEAP32[4529] = -1;
   $$01$i$i = 0;
   do {
    $634 = 18124 + ($$01$i$i << 1 << 2) | 0;
    HEAP32[$634 + 12 >> 2] = $634;
    HEAP32[$634 + 8 >> 2] = $634;
    $$01$i$i = $$01$i$i + 1 | 0;
   } while (($$01$i$i | 0) != 32);
   $640 = $$748$i + 8 | 0;
   $645 = ($640 & 7 | 0) == 0 ? 0 : 0 - $640 & 7;
   $646 = $$748$i + $645 | 0;
   $647 = $$723947$i + -40 - $645 | 0;
   HEAP32[4527] = $646;
   HEAP32[4524] = $647;
   HEAP32[$646 + 4 >> 2] = $647 | 1;
   HEAP32[$646 + $647 + 4 >> 2] = 40;
   HEAP32[4528] = HEAP32[4643];
  } else {
   $$024370$i = 18532;
   while (1) {
    $653 = HEAP32[$$024370$i >> 2] | 0;
    $654 = $$024370$i + 4 | 0;
    $655 = HEAP32[$654 >> 2] | 0;
    if (($$748$i | 0) == ($653 + $655 | 0)) {
     label = 200;
     break;
    }
    $659 = HEAP32[$$024370$i + 8 >> 2] | 0;
    if (!$659) break; else $$024370$i = $659;
   }
   if ((label | 0) == 200) if (!(HEAP32[$$024370$i + 12 >> 2] & 8)) if ($627 >>> 0 < $$748$i >>> 0 & $627 >>> 0 >= $653 >>> 0) {
    HEAP32[$654 >> 2] = $655 + $$723947$i;
    $670 = $627 + 8 | 0;
    $675 = ($670 & 7 | 0) == 0 ? 0 : 0 - $670 & 7;
    $676 = $627 + $675 | 0;
    $678 = $$723947$i - $675 + (HEAP32[4524] | 0) | 0;
    HEAP32[4527] = $676;
    HEAP32[4524] = $678;
    HEAP32[$676 + 4 >> 2] = $678 | 1;
    HEAP32[$676 + $678 + 4 >> 2] = 40;
    HEAP32[4528] = HEAP32[4643];
    break;
   }
   $684 = HEAP32[4525] | 0;
   if ($$748$i >>> 0 < $684 >>> 0) {
    HEAP32[4525] = $$748$i;
    $749 = $$748$i;
   } else $749 = $684;
   $686 = $$748$i + $$723947$i | 0;
   $$124469$i = 18532;
   while (1) {
    if ((HEAP32[$$124469$i >> 2] | 0) == ($686 | 0)) {
     label = 208;
     break;
    }
    $690 = HEAP32[$$124469$i + 8 >> 2] | 0;
    if (!$690) {
     $$0$i$i$i = 18532;
     break;
    } else $$124469$i = $690;
   }
   if ((label | 0) == 208) if (!(HEAP32[$$124469$i + 12 >> 2] & 8)) {
    HEAP32[$$124469$i >> 2] = $$748$i;
    $696 = $$124469$i + 4 | 0;
    HEAP32[$696 >> 2] = (HEAP32[$696 >> 2] | 0) + $$723947$i;
    $700 = $$748$i + 8 | 0;
    $706 = $$748$i + (($700 & 7 | 0) == 0 ? 0 : 0 - $700 & 7) | 0;
    $708 = $686 + 8 | 0;
    $714 = $686 + (($708 & 7 | 0) == 0 ? 0 : 0 - $708 & 7) | 0;
    $718 = $706 + $$0197 | 0;
    $719 = $714 - $706 - $$0197 | 0;
    HEAP32[$706 + 4 >> 2] = $$0197 | 3;
    do if (($714 | 0) == ($627 | 0)) {
     $724 = (HEAP32[4524] | 0) + $719 | 0;
     HEAP32[4524] = $724;
     HEAP32[4527] = $718;
     HEAP32[$718 + 4 >> 2] = $724 | 1;
    } else {
     if (($714 | 0) == (HEAP32[4526] | 0)) {
      $730 = (HEAP32[4523] | 0) + $719 | 0;
      HEAP32[4523] = $730;
      HEAP32[4526] = $718;
      HEAP32[$718 + 4 >> 2] = $730 | 1;
      HEAP32[$718 + $730 >> 2] = $730;
      break;
     }
     $735 = HEAP32[$714 + 4 >> 2] | 0;
     if (($735 & 3 | 0) == 1) {
      $738 = $735 & -8;
      $739 = $735 >>> 3;
      L326 : do if ($735 >>> 0 < 256) {
       $742 = HEAP32[$714 + 8 >> 2] | 0;
       $744 = HEAP32[$714 + 12 >> 2] | 0;
       $746 = 18124 + ($739 << 1 << 2) | 0;
       do if (($742 | 0) != ($746 | 0)) {
        if ($742 >>> 0 < $749 >>> 0) _abort();
        if ((HEAP32[$742 + 12 >> 2] | 0) == ($714 | 0)) break;
        _abort();
       } while (0);
       if (($744 | 0) == ($742 | 0)) {
        HEAP32[4521] = HEAP32[4521] & ~(1 << $739);
        break;
       }
       do if (($744 | 0) == ($746 | 0)) $$pre$phi10$i$iZ2D = $744 + 8 | 0; else {
        if ($744 >>> 0 < $749 >>> 0) _abort();
        $760 = $744 + 8 | 0;
        if ((HEAP32[$760 >> 2] | 0) == ($714 | 0)) {
         $$pre$phi10$i$iZ2D = $760;
         break;
        }
        _abort();
       } while (0);
       HEAP32[$742 + 12 >> 2] = $744;
       HEAP32[$$pre$phi10$i$iZ2D >> 2] = $742;
      } else {
       $765 = HEAP32[$714 + 24 >> 2] | 0;
       $767 = HEAP32[$714 + 12 >> 2] | 0;
       do if (($767 | 0) == ($714 | 0)) {
        $778 = $714 + 16 | 0;
        $779 = $778 + 4 | 0;
        $780 = HEAP32[$779 >> 2] | 0;
        if (!$780) {
         $782 = HEAP32[$778 >> 2] | 0;
         if (!$782) {
          $$3$i$i = 0;
          break;
         } else {
          $$1290$i$i = $782;
          $$1292$i$i = $778;
         }
        } else {
         $$1290$i$i = $780;
         $$1292$i$i = $779;
        }
        while (1) {
         $784 = $$1290$i$i + 20 | 0;
         $785 = HEAP32[$784 >> 2] | 0;
         if ($785 | 0) {
          $$1290$i$i = $785;
          $$1292$i$i = $784;
          continue;
         }
         $787 = $$1290$i$i + 16 | 0;
         $788 = HEAP32[$787 >> 2] | 0;
         if (!$788) break; else {
          $$1290$i$i = $788;
          $$1292$i$i = $787;
         }
        }
        if ($$1292$i$i >>> 0 < $749 >>> 0) _abort(); else {
         HEAP32[$$1292$i$i >> 2] = 0;
         $$3$i$i = $$1290$i$i;
         break;
        }
       } else {
        $770 = HEAP32[$714 + 8 >> 2] | 0;
        if ($770 >>> 0 < $749 >>> 0) _abort();
        $772 = $770 + 12 | 0;
        if ((HEAP32[$772 >> 2] | 0) != ($714 | 0)) _abort();
        $775 = $767 + 8 | 0;
        if ((HEAP32[$775 >> 2] | 0) == ($714 | 0)) {
         HEAP32[$772 >> 2] = $767;
         HEAP32[$775 >> 2] = $770;
         $$3$i$i = $767;
         break;
        } else _abort();
       } while (0);
       if (!$765) break;
       $793 = HEAP32[$714 + 28 >> 2] | 0;
       $794 = 18388 + ($793 << 2) | 0;
       do if (($714 | 0) == (HEAP32[$794 >> 2] | 0)) {
        HEAP32[$794 >> 2] = $$3$i$i;
        if ($$3$i$i | 0) break;
        HEAP32[4522] = HEAP32[4522] & ~(1 << $793);
        break L326;
       } else {
        if ($765 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort();
        $803 = $765 + 16 | 0;
        if ((HEAP32[$803 >> 2] | 0) == ($714 | 0)) HEAP32[$803 >> 2] = $$3$i$i; else HEAP32[$765 + 20 >> 2] = $$3$i$i;
        if (!$$3$i$i) break L326;
       } while (0);
       $808 = HEAP32[4525] | 0;
       if ($$3$i$i >>> 0 < $808 >>> 0) _abort();
       HEAP32[$$3$i$i + 24 >> 2] = $765;
       $811 = $714 + 16 | 0;
       $812 = HEAP32[$811 >> 2] | 0;
       do if ($812 | 0) if ($812 >>> 0 < $808 >>> 0) _abort(); else {
        HEAP32[$$3$i$i + 16 >> 2] = $812;
        HEAP32[$812 + 24 >> 2] = $$3$i$i;
        break;
       } while (0);
       $818 = HEAP32[$811 + 4 >> 2] | 0;
       if (!$818) break;
       if ($818 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
        HEAP32[$$3$i$i + 20 >> 2] = $818;
        HEAP32[$818 + 24 >> 2] = $$3$i$i;
        break;
       }
      } while (0);
      $$0$i18$i = $714 + $738 | 0;
      $$0286$i$i = $738 + $719 | 0;
     } else {
      $$0$i18$i = $714;
      $$0286$i$i = $719;
     }
     $826 = $$0$i18$i + 4 | 0;
     HEAP32[$826 >> 2] = HEAP32[$826 >> 2] & -2;
     HEAP32[$718 + 4 >> 2] = $$0286$i$i | 1;
     HEAP32[$718 + $$0286$i$i >> 2] = $$0286$i$i;
     $832 = $$0286$i$i >>> 3;
     if ($$0286$i$i >>> 0 < 256) {
      $835 = 18124 + ($832 << 1 << 2) | 0;
      $836 = HEAP32[4521] | 0;
      $837 = 1 << $832;
      do if (!($836 & $837)) {
       HEAP32[4521] = $836 | $837;
       $$0294$i$i = $835;
       $$pre$phi$i20$iZ2D = $835 + 8 | 0;
      } else {
       $841 = $835 + 8 | 0;
       $842 = HEAP32[$841 >> 2] | 0;
       if ($842 >>> 0 >= (HEAP32[4525] | 0) >>> 0) {
        $$0294$i$i = $842;
        $$pre$phi$i20$iZ2D = $841;
        break;
       }
       _abort();
      } while (0);
      HEAP32[$$pre$phi$i20$iZ2D >> 2] = $718;
      HEAP32[$$0294$i$i + 12 >> 2] = $718;
      HEAP32[$718 + 8 >> 2] = $$0294$i$i;
      HEAP32[$718 + 12 >> 2] = $835;
      break;
     }
     $848 = $$0286$i$i >>> 8;
     do if (!$848) $$0295$i$i = 0; else {
      if ($$0286$i$i >>> 0 > 16777215) {
       $$0295$i$i = 31;
       break;
      }
      $853 = ($848 + 1048320 | 0) >>> 16 & 8;
      $854 = $848 << $853;
      $857 = ($854 + 520192 | 0) >>> 16 & 4;
      $859 = $854 << $857;
      $862 = ($859 + 245760 | 0) >>> 16 & 2;
      $867 = 14 - ($857 | $853 | $862) + ($859 << $862 >>> 15) | 0;
      $$0295$i$i = $$0286$i$i >>> ($867 + 7 | 0) & 1 | $867 << 1;
     } while (0);
     $873 = 18388 + ($$0295$i$i << 2) | 0;
     HEAP32[$718 + 28 >> 2] = $$0295$i$i;
     $875 = $718 + 16 | 0;
     HEAP32[$875 + 4 >> 2] = 0;
     HEAP32[$875 >> 2] = 0;
     $877 = HEAP32[4522] | 0;
     $878 = 1 << $$0295$i$i;
     if (!($877 & $878)) {
      HEAP32[4522] = $877 | $878;
      HEAP32[$873 >> 2] = $718;
      HEAP32[$718 + 24 >> 2] = $873;
      HEAP32[$718 + 12 >> 2] = $718;
      HEAP32[$718 + 8 >> 2] = $718;
      break;
     }
     $$0287$i$i = $$0286$i$i << (($$0295$i$i | 0) == 31 ? 0 : 25 - ($$0295$i$i >>> 1) | 0);
     $$0288$i$i = HEAP32[$873 >> 2] | 0;
     while (1) {
      if ((HEAP32[$$0288$i$i + 4 >> 2] & -8 | 0) == ($$0286$i$i | 0)) {
       label = 278;
       break;
      }
      $896 = $$0288$i$i + 16 + ($$0287$i$i >>> 31 << 2) | 0;
      $898 = HEAP32[$896 >> 2] | 0;
      if (!$898) {
       label = 275;
       break;
      } else {
       $$0287$i$i = $$0287$i$i << 1;
       $$0288$i$i = $898;
      }
     }
     if ((label | 0) == 275) if ($896 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
      HEAP32[$896 >> 2] = $718;
      HEAP32[$718 + 24 >> 2] = $$0288$i$i;
      HEAP32[$718 + 12 >> 2] = $718;
      HEAP32[$718 + 8 >> 2] = $718;
      break;
     } else if ((label | 0) == 278) {
      $905 = $$0288$i$i + 8 | 0;
      $906 = HEAP32[$905 >> 2] | 0;
      $907 = HEAP32[4525] | 0;
      if ($906 >>> 0 >= $907 >>> 0 & $$0288$i$i >>> 0 >= $907 >>> 0) {
       HEAP32[$906 + 12 >> 2] = $718;
       HEAP32[$905 >> 2] = $718;
       HEAP32[$718 + 8 >> 2] = $906;
       HEAP32[$718 + 12 >> 2] = $$0288$i$i;
       HEAP32[$718 + 24 >> 2] = 0;
       break;
      } else _abort();
     }
    } while (0);
    $$0 = $706 + 8 | 0;
    STACKTOP = sp;
    return $$0 | 0;
   } else $$0$i$i$i = 18532;
   while (1) {
    $914 = HEAP32[$$0$i$i$i >> 2] | 0;
    if ($914 >>> 0 <= $627 >>> 0) {
     $918 = $914 + (HEAP32[$$0$i$i$i + 4 >> 2] | 0) | 0;
     if ($918 >>> 0 > $627 >>> 0) break;
    }
    $$0$i$i$i = HEAP32[$$0$i$i$i + 8 >> 2] | 0;
   }
   $922 = $918 + -47 | 0;
   $924 = $922 + 8 | 0;
   $930 = $922 + (($924 & 7 | 0) == 0 ? 0 : 0 - $924 & 7) | 0;
   $931 = $627 + 16 | 0;
   $933 = $930 >>> 0 < $931 >>> 0 ? $627 : $930;
   $934 = $933 + 8 | 0;
   $938 = $$748$i + 8 | 0;
   $943 = ($938 & 7 | 0) == 0 ? 0 : 0 - $938 & 7;
   $944 = $$748$i + $943 | 0;
   $945 = $$723947$i + -40 - $943 | 0;
   HEAP32[4527] = $944;
   HEAP32[4524] = $945;
   HEAP32[$944 + 4 >> 2] = $945 | 1;
   HEAP32[$944 + $945 + 4 >> 2] = 40;
   HEAP32[4528] = HEAP32[4643];
   $951 = $933 + 4 | 0;
   HEAP32[$951 >> 2] = 27;
   HEAP32[$934 >> 2] = HEAP32[4633];
   HEAP32[$934 + 4 >> 2] = HEAP32[4634];
   HEAP32[$934 + 8 >> 2] = HEAP32[4635];
   HEAP32[$934 + 12 >> 2] = HEAP32[4636];
   HEAP32[4633] = $$748$i;
   HEAP32[4634] = $$723947$i;
   HEAP32[4636] = 0;
   HEAP32[4635] = $934;
   $$0$i$i = $933 + 24 | 0;
   do {
    $$0$i$i = $$0$i$i + 4 | 0;
    HEAP32[$$0$i$i >> 2] = 7;
   } while (($$0$i$i + 4 | 0) >>> 0 < $918 >>> 0);
   if (($933 | 0) != ($627 | 0)) {
    $958 = $933 - $627 | 0;
    HEAP32[$951 >> 2] = HEAP32[$951 >> 2] & -2;
    HEAP32[$627 + 4 >> 2] = $958 | 1;
    HEAP32[$933 >> 2] = $958;
    $963 = $958 >>> 3;
    if ($958 >>> 0 < 256) {
     $966 = 18124 + ($963 << 1 << 2) | 0;
     $967 = HEAP32[4521] | 0;
     $968 = 1 << $963;
     if (!($967 & $968)) {
      HEAP32[4521] = $967 | $968;
      $$0211$i$i = $966;
      $$pre$phi$i$iZ2D = $966 + 8 | 0;
     } else {
      $972 = $966 + 8 | 0;
      $973 = HEAP32[$972 >> 2] | 0;
      if ($973 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
       $$0211$i$i = $973;
       $$pre$phi$i$iZ2D = $972;
      }
     }
     HEAP32[$$pre$phi$i$iZ2D >> 2] = $627;
     HEAP32[$$0211$i$i + 12 >> 2] = $627;
     HEAP32[$627 + 8 >> 2] = $$0211$i$i;
     HEAP32[$627 + 12 >> 2] = $966;
     break;
    }
    $979 = $958 >>> 8;
    if (!$979) $$0212$i$i = 0; else if ($958 >>> 0 > 16777215) $$0212$i$i = 31; else {
     $984 = ($979 + 1048320 | 0) >>> 16 & 8;
     $985 = $979 << $984;
     $988 = ($985 + 520192 | 0) >>> 16 & 4;
     $990 = $985 << $988;
     $993 = ($990 + 245760 | 0) >>> 16 & 2;
     $998 = 14 - ($988 | $984 | $993) + ($990 << $993 >>> 15) | 0;
     $$0212$i$i = $958 >>> ($998 + 7 | 0) & 1 | $998 << 1;
    }
    $1004 = 18388 + ($$0212$i$i << 2) | 0;
    HEAP32[$627 + 28 >> 2] = $$0212$i$i;
    HEAP32[$627 + 20 >> 2] = 0;
    HEAP32[$931 >> 2] = 0;
    $1007 = HEAP32[4522] | 0;
    $1008 = 1 << $$0212$i$i;
    if (!($1007 & $1008)) {
     HEAP32[4522] = $1007 | $1008;
     HEAP32[$1004 >> 2] = $627;
     HEAP32[$627 + 24 >> 2] = $1004;
     HEAP32[$627 + 12 >> 2] = $627;
     HEAP32[$627 + 8 >> 2] = $627;
     break;
    }
    $$0206$i$i = $958 << (($$0212$i$i | 0) == 31 ? 0 : 25 - ($$0212$i$i >>> 1) | 0);
    $$0207$i$i = HEAP32[$1004 >> 2] | 0;
    while (1) {
     if ((HEAP32[$$0207$i$i + 4 >> 2] & -8 | 0) == ($958 | 0)) {
      label = 304;
      break;
     }
     $1026 = $$0207$i$i + 16 + ($$0206$i$i >>> 31 << 2) | 0;
     $1028 = HEAP32[$1026 >> 2] | 0;
     if (!$1028) {
      label = 301;
      break;
     } else {
      $$0206$i$i = $$0206$i$i << 1;
      $$0207$i$i = $1028;
     }
    }
    if ((label | 0) == 301) if ($1026 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
     HEAP32[$1026 >> 2] = $627;
     HEAP32[$627 + 24 >> 2] = $$0207$i$i;
     HEAP32[$627 + 12 >> 2] = $627;
     HEAP32[$627 + 8 >> 2] = $627;
     break;
    } else if ((label | 0) == 304) {
     $1035 = $$0207$i$i + 8 | 0;
     $1036 = HEAP32[$1035 >> 2] | 0;
     $1037 = HEAP32[4525] | 0;
     if ($1036 >>> 0 >= $1037 >>> 0 & $$0207$i$i >>> 0 >= $1037 >>> 0) {
      HEAP32[$1036 + 12 >> 2] = $627;
      HEAP32[$1035 >> 2] = $627;
      HEAP32[$627 + 8 >> 2] = $1036;
      HEAP32[$627 + 12 >> 2] = $$0207$i$i;
      HEAP32[$627 + 24 >> 2] = 0;
      break;
     } else _abort();
    }
   }
  } while (0);
  $1045 = HEAP32[4524] | 0;
  if ($1045 >>> 0 > $$0197 >>> 0) {
   $1047 = $1045 - $$0197 | 0;
   HEAP32[4524] = $1047;
   $1048 = HEAP32[4527] | 0;
   $1049 = $1048 + $$0197 | 0;
   HEAP32[4527] = $1049;
   HEAP32[$1049 + 4 >> 2] = $1047 | 1;
   HEAP32[$1048 + 4 >> 2] = $$0197 | 3;
   $$0 = $1048 + 8 | 0;
   STACKTOP = sp;
   return $$0 | 0;
  }
 }
 HEAP32[(___errno_location() | 0) >> 2] = 12;
 $$0 = 0;
 STACKTOP = sp;
 return $$0 | 0;
}

function _build_tree($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$ = 0, $$$2 = 0, $$$2$us = 0, $$$i = 0, $$$us = 0, $$$us$i = 0, $$0 = 0, $$0$$i = 0, $$0$$us$i = 0, $$0$i$i = 0, $$0$lcssa$i = 0, $$010810$i = 0, $$010812$i = 0, $$010812$us$i = 0, $$011$i = 0, $$011$us$i = 0, $$0111$i = 0, $$0111$us$i = 0, $$0115$ph$i131 = 0, $$02430$i = 0, $$02527$i = 0, $$02629$i = 0, $$052$lcssa$i = 0, $$052$lcssa$i112 = 0, $$052$lcssa$i120 = 0, $$05254$i = 0, $$05254$i109 = 0, $$05254$i117 = 0, $$053$i = 0, $$055$i = 0, $$055$i108 = 0, $$055$i116 = 0, $$07$i$i = 0, $$08$i$i = 0, $$097$lcssa152 = 0, $$097138 = 0, $$098137 = 0, $$1 = 0, $$1$i = 0, $$1$i110 = 0, $$1$i118 = 0, $$11099$i = 0, $$199133 = 0, $$2$i = 0, $$2$lcssa = 0, $$2110$i = 0, $$2110$ph$i$lcssa = 0, $$2110$ph$i132 = 0, $$2114$i = 0, $$2114$in$i = 0, $$2134 = 0, $$2134$us = 0, $$37$i = 0, $$idx$val = 0, $$idx101$val = 0, $$idx102$val = 0, $$pre = 0, $10 = 0, $101 = 0, $102 = 0, $104 = 0, $106 = 0, $107 = 0, $109 = 0, $111 = 0, $113 = 0, $115 = 0, $123 = 0, $125 = 0, $127 = 0, $13 = 0, $138 = 0, $140 = 0, $143 = 0, $15 = 0, $153 = 0, $155 = 0, $157 = 0, $16 = 0, $162 = 0, $163 = 0, $167 = 0, $17 = 0, $170 = 0, $171 = 0, $173 = 0, $175 = 0, $177 = 0, $179 = 0, $18 = 0, $187 = 0, $189 = 0, $19 = 0, $191 = 0, $2 = 0, $204 = 0, $206 = 0, $208 = 0, $210 = 0, $212 = 0, $214 = 0, $215 = 0, $220 = 0, $222 = 0, $224 = 0, $225 = 0, $230 = 0, $232 = 0, $237 = 0, $248 = 0, $25 = 0, $252 = 0, $253 = 0, $258 = 0, $260 = 0, $265 = 0, $274 = 0, $276 = 0, $283 = 0, $287 = 0, $288 = 0, $289 = 0, $292 = 0, $298 = 0, $3 = 0, $302 = 0, $303 = 0, $308 = 0, $31 = 0, $310 = 0, $312 = 0, $318 = 0, $323 = 0, $336 = 0, $337 = 0, $339 = 0, $340 = 0, $344 = 0, $352 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $50 = 0, $52 = 0, $54 = 0, $55 = 0, $57 = 0, $58 = 0, $6 = 0, $60 = 0, $61 = 0, $63 = 0, $64 = 0, $66 = 0, $68 = 0, $70 = 0, $72 = 0, $8 = 0, $80 = 0, $82 = 0, $84 = 0, $9 = 0, $97 = 0, $98 = 0, $99 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32 | 0;
 $2 = sp;
 $3 = HEAP32[$1 >> 2] | 0;
 $4 = $1 + 8 | 0;
 $5 = HEAP32[$4 >> 2] | 0;
 $6 = HEAP32[$5 >> 2] | 0;
 $8 = HEAP32[$5 + 12 >> 2] | 0;
 $9 = $0 + 5200 | 0;
 HEAP32[$9 >> 2] = 0;
 $10 = $0 + 5204 | 0;
 HEAP32[$10 >> 2] = 573;
 if (($8 | 0) > 0) {
  $$097138 = -1;
  $$098137 = 0;
  while (1) {
   if (!(HEAP16[$3 + ($$098137 << 2) >> 1] | 0)) {
    HEAP16[$3 + ($$098137 << 2) + 2 >> 1] = 0;
    $$1 = $$097138;
   } else {
    $31 = (HEAP32[$9 >> 2] | 0) + 1 | 0;
    HEAP32[$9 >> 2] = $31;
    HEAP32[$0 + 2908 + ($31 << 2) >> 2] = $$098137;
    HEAP8[$0 + 5208 + $$098137 >> 0] = 0;
    $$1 = $$098137;
   }
   $$098137 = $$098137 + 1 | 0;
   if (($$098137 | 0) == ($8 | 0)) break; else $$097138 = $$1;
  }
  $$pre = HEAP32[$9 >> 2] | 0;
  if (($$pre | 0) < 2) {
   $$097$lcssa152 = $$1;
   $352 = $$pre;
   label = 3;
  } else {
   $$2$lcssa = $$1;
   $54 = $$pre;
  }
 } else {
  $$097$lcssa152 = -1;
  $352 = 0;
  label = 3;
 }
 if ((label | 0) == 3) {
  $13 = $0 + 5800 | 0;
  $15 = $0 + 5804 | 0;
  if (!$6) {
   $$2134$us = $$097$lcssa152;
   $19 = $352;
   while (1) {
    $16 = ($$2134$us | 0) < 2;
    $17 = $$2134$us + 1 | 0;
    $$$2$us = $16 ? $17 : $$2134$us;
    $$$us = $16 ? $17 : 0;
    $18 = $19 + 1 | 0;
    HEAP32[$9 >> 2] = $18;
    HEAP32[$0 + 2908 + ($18 << 2) >> 2] = $$$us;
    HEAP16[$3 + ($$$us << 2) >> 1] = 1;
    HEAP8[$0 + 5208 + $$$us >> 0] = 0;
    HEAP32[$13 >> 2] = (HEAP32[$13 >> 2] | 0) + -1;
    $25 = HEAP32[$9 >> 2] | 0;
    if (($25 | 0) < 2) {
     $$2134$us = $$$2$us;
     $19 = $25;
    } else {
     $$2$lcssa = $$$2$us;
     $54 = $25;
     break;
    }
   }
  } else {
   $$2134 = $$097$lcssa152;
   $39 = $352;
   while (1) {
    $36 = ($$2134 | 0) < 2;
    $37 = $$2134 + 1 | 0;
    $$$2 = $36 ? $37 : $$2134;
    $$ = $36 ? $37 : 0;
    $38 = $39 + 1 | 0;
    HEAP32[$9 >> 2] = $38;
    HEAP32[$0 + 2908 + ($38 << 2) >> 2] = $$;
    HEAP16[$3 + ($$ << 2) >> 1] = 1;
    HEAP8[$0 + 5208 + $$ >> 0] = 0;
    HEAP32[$13 >> 2] = (HEAP32[$13 >> 2] | 0) + -1;
    HEAP32[$15 >> 2] = (HEAP32[$15 >> 2] | 0) - (HEAPU16[$6 + ($$ << 2) + 2 >> 1] | 0);
    $50 = HEAP32[$9 >> 2] | 0;
    if (($50 | 0) < 2) {
     $$2134 = $$$2;
     $39 = $50;
    } else {
     $$2$lcssa = $$$2;
     $54 = $50;
     break;
    }
   }
  }
 }
 $52 = $1 + 4 | 0;
 HEAP32[$52 >> 2] = $$2$lcssa;
 $$199133 = ($54 | 0) / 2 | 0;
 $60 = $54;
 while (1) {
  $57 = HEAP32[$0 + 2908 + ($$199133 << 2) >> 2] | 0;
  $58 = $0 + 5208 + $57 | 0;
  $$053$i = $$199133 << 1;
  L19 : do if (($$053$i | 0) > ($60 | 0)) $$052$lcssa$i = $$199133; else {
   $61 = $3 + ($57 << 2) | 0;
   $$05254$i = $$199133;
   $$055$i = $$053$i;
   $63 = $60;
   while (1) {
    do if (($$055$i | 0) < ($63 | 0)) {
     $64 = $$055$i | 1;
     $66 = HEAP32[$0 + 2908 + ($64 << 2) >> 2] | 0;
     $68 = HEAP16[$3 + ($66 << 2) >> 1] | 0;
     $70 = HEAP32[$0 + 2908 + ($$055$i << 2) >> 2] | 0;
     $72 = HEAP16[$3 + ($70 << 2) >> 1] | 0;
     if (($68 & 65535) >= ($72 & 65535)) {
      if ($68 << 16 >> 16 != $72 << 16 >> 16) {
       $$1$i = $$055$i;
       break;
      }
      if ((HEAPU8[$0 + 5208 + $66 >> 0] | 0) > (HEAPU8[$0 + 5208 + $70 >> 0] | 0)) {
       $$1$i = $$055$i;
       break;
      }
     }
     $$1$i = $64;
    } else $$1$i = $$055$i; while (0);
    $80 = HEAP16[$61 >> 1] | 0;
    $82 = HEAP32[$0 + 2908 + ($$1$i << 2) >> 2] | 0;
    $84 = HEAP16[$3 + ($82 << 2) >> 1] | 0;
    if (($80 & 65535) < ($84 & 65535)) {
     $$052$lcssa$i = $$05254$i;
     break L19;
    }
    if ($80 << 16 >> 16 == $84 << 16 >> 16) if ((HEAPU8[$58 >> 0] | 0) <= (HEAPU8[$0 + 5208 + $82 >> 0] | 0)) {
     $$052$lcssa$i = $$05254$i;
     break L19;
    }
    HEAP32[$0 + 2908 + ($$05254$i << 2) >> 2] = $82;
    $$055$i = $$1$i << 1;
    $63 = HEAP32[$9 >> 2] | 0;
    if (($$055$i | 0) > ($63 | 0)) {
     $$052$lcssa$i = $$1$i;
     break;
    } else $$05254$i = $$1$i;
   }
  } while (0);
  HEAP32[$0 + 2908 + ($$052$lcssa$i << 2) >> 2] = $57;
  if (($$199133 | 0) <= 1) break;
  $$199133 = $$199133 + -1 | 0;
  $60 = HEAP32[$9 >> 2] | 0;
 }
 $55 = $0 + 2912 | 0;
 $$0 = $8;
 $99 = HEAP32[$9 >> 2] | 0;
 do {
  $97 = HEAP32[$55 >> 2] | 0;
  $98 = $99 + -1 | 0;
  HEAP32[$9 >> 2] = $98;
  $101 = HEAP32[$0 + 2908 + ($99 << 2) >> 2] | 0;
  HEAP32[$55 >> 2] = $101;
  $102 = $0 + 5208 + $101 | 0;
  L39 : do if (($99 | 0) < 3) $$052$lcssa$i120 = 1; else {
   $104 = $3 + ($101 << 2) | 0;
   $$05254$i117 = 1;
   $$055$i116 = 2;
   $106 = $98;
   while (1) {
    do if (($$055$i116 | 0) < ($106 | 0)) {
     $107 = $$055$i116 | 1;
     $109 = HEAP32[$0 + 2908 + ($107 << 2) >> 2] | 0;
     $111 = HEAP16[$3 + ($109 << 2) >> 1] | 0;
     $113 = HEAP32[$0 + 2908 + ($$055$i116 << 2) >> 2] | 0;
     $115 = HEAP16[$3 + ($113 << 2) >> 1] | 0;
     if (($111 & 65535) >= ($115 & 65535)) {
      if ($111 << 16 >> 16 != $115 << 16 >> 16) {
       $$1$i118 = $$055$i116;
       break;
      }
      if ((HEAPU8[$0 + 5208 + $109 >> 0] | 0) > (HEAPU8[$0 + 5208 + $113 >> 0] | 0)) {
       $$1$i118 = $$055$i116;
       break;
      }
     }
     $$1$i118 = $107;
    } else $$1$i118 = $$055$i116; while (0);
    $123 = HEAP16[$104 >> 1] | 0;
    $125 = HEAP32[$0 + 2908 + ($$1$i118 << 2) >> 2] | 0;
    $127 = HEAP16[$3 + ($125 << 2) >> 1] | 0;
    if (($123 & 65535) < ($127 & 65535)) {
     $$052$lcssa$i120 = $$05254$i117;
     break L39;
    }
    if ($123 << 16 >> 16 == $127 << 16 >> 16) if ((HEAPU8[$102 >> 0] | 0) <= (HEAPU8[$0 + 5208 + $125 >> 0] | 0)) {
     $$052$lcssa$i120 = $$05254$i117;
     break L39;
    }
    HEAP32[$0 + 2908 + ($$05254$i117 << 2) >> 2] = $125;
    $$055$i116 = $$1$i118 << 1;
    $106 = HEAP32[$9 >> 2] | 0;
    if (($$055$i116 | 0) > ($106 | 0)) {
     $$052$lcssa$i120 = $$1$i118;
     break;
    } else $$05254$i117 = $$1$i118;
   }
  } while (0);
  HEAP32[$0 + 2908 + ($$052$lcssa$i120 << 2) >> 2] = $101;
  $138 = HEAP32[$55 >> 2] | 0;
  $140 = (HEAP32[$10 >> 2] | 0) + -1 | 0;
  HEAP32[$10 >> 2] = $140;
  HEAP32[$0 + 2908 + ($140 << 2) >> 2] = $97;
  $143 = (HEAP32[$10 >> 2] | 0) + -1 | 0;
  HEAP32[$10 >> 2] = $143;
  HEAP32[$0 + 2908 + ($143 << 2) >> 2] = $138;
  $153 = $3 + ($$0 << 2) | 0;
  HEAP16[$153 >> 1] = (HEAPU16[$3 + ($138 << 2) >> 1] | 0) + (HEAPU16[$3 + ($97 << 2) >> 1] | 0);
  $155 = HEAP8[$0 + 5208 + $97 >> 0] | 0;
  $157 = HEAP8[$0 + 5208 + $138 >> 0] | 0;
  $162 = $0 + 5208 + $$0 | 0;
  HEAP8[$162 >> 0] = ((($155 & 255) < ($157 & 255) ? $157 : $155) & 255) + 1;
  $163 = $$0 & 65535;
  HEAP16[$3 + ($138 << 2) + 2 >> 1] = $163;
  HEAP16[$3 + ($97 << 2) + 2 >> 1] = $163;
  HEAP32[$55 >> 2] = $$0;
  $167 = HEAP32[$9 >> 2] | 0;
  L55 : do if (($167 | 0) < 2) $$052$lcssa$i112 = 1; else {
   $$05254$i109 = 1;
   $$055$i108 = 2;
   $170 = $167;
   while (1) {
    do if (($$055$i108 | 0) < ($170 | 0)) {
     $171 = $$055$i108 | 1;
     $173 = HEAP32[$0 + 2908 + ($171 << 2) >> 2] | 0;
     $175 = HEAP16[$3 + ($173 << 2) >> 1] | 0;
     $177 = HEAP32[$0 + 2908 + ($$055$i108 << 2) >> 2] | 0;
     $179 = HEAP16[$3 + ($177 << 2) >> 1] | 0;
     if (($175 & 65535) >= ($179 & 65535)) {
      if ($175 << 16 >> 16 != $179 << 16 >> 16) {
       $$1$i110 = $$055$i108;
       break;
      }
      if ((HEAPU8[$0 + 5208 + $173 >> 0] | 0) > (HEAPU8[$0 + 5208 + $177 >> 0] | 0)) {
       $$1$i110 = $$055$i108;
       break;
      }
     }
     $$1$i110 = $171;
    } else $$1$i110 = $$055$i108; while (0);
    $187 = HEAP16[$153 >> 1] | 0;
    $189 = HEAP32[$0 + 2908 + ($$1$i110 << 2) >> 2] | 0;
    $191 = HEAP16[$3 + ($189 << 2) >> 1] | 0;
    if (($187 & 65535) < ($191 & 65535)) {
     $$052$lcssa$i112 = $$05254$i109;
     break L55;
    }
    if ($187 << 16 >> 16 == $191 << 16 >> 16) if ((HEAPU8[$162 >> 0] | 0) <= (HEAPU8[$0 + 5208 + $189 >> 0] | 0)) {
     $$052$lcssa$i112 = $$05254$i109;
     break L55;
    }
    HEAP32[$0 + 2908 + ($$05254$i109 << 2) >> 2] = $189;
    $$055$i108 = $$1$i110 << 1;
    $170 = HEAP32[$9 >> 2] | 0;
    if (($$055$i108 | 0) > ($170 | 0)) {
     $$052$lcssa$i112 = $$1$i110;
     break;
    } else $$05254$i109 = $$1$i110;
   }
  } while (0);
  HEAP32[$0 + 2908 + ($$052$lcssa$i112 << 2) >> 2] = $$0;
  $$0 = $$0 + 1 | 0;
  $99 = HEAP32[$9 >> 2] | 0;
 } while (($99 | 0) > 1);
 $204 = HEAP32[$55 >> 2] | 0;
 $206 = (HEAP32[$10 >> 2] | 0) + -1 | 0;
 HEAP32[$10 >> 2] = $206;
 HEAP32[$0 + 2908 + ($206 << 2) >> 2] = $204;
 $$idx$val = HEAP32[$1 >> 2] | 0;
 $$idx101$val = HEAP32[$52 >> 2] | 0;
 $$idx102$val = HEAP32[$4 >> 2] | 0;
 $208 = HEAP32[$$idx102$val >> 2] | 0;
 $210 = HEAP32[$$idx102$val + 4 >> 2] | 0;
 $212 = HEAP32[$$idx102$val + 8 >> 2] | 0;
 $214 = HEAP32[$$idx102$val + 16 >> 2] | 0;
 dest = $0 + 2876 | 0;
 stop = dest + 32 | 0;
 do {
  HEAP16[dest >> 1] = 0;
  dest = dest + 2 | 0;
 } while ((dest | 0) < (stop | 0));
 $215 = HEAP32[$10 >> 2] | 0;
 HEAP16[$$idx$val + (HEAP32[$0 + 2908 + ($215 << 2) >> 2] << 2) + 2 >> 1] = 0;
 $$010810$i = $215 + 1 | 0;
 L71 : do if (($$010810$i | 0) < 573) {
  $220 = $0 + 5800 | 0;
  $222 = $0 + 5804 | 0;
  if (!$208) {
   $$010812$us$i = $$010810$i;
   $$011$us$i = 0;
   while (1) {
    $224 = HEAP32[$0 + 2908 + ($$010812$us$i << 2) >> 2] | 0;
    $225 = $$idx$val + ($224 << 2) + 2 | 0;
    $230 = HEAPU16[$$idx$val + (HEAPU16[$225 >> 1] << 2) + 2 >> 1] | 0;
    $232 = ($230 | 0) < ($214 | 0);
    $$$us$i = $232 ? $230 + 1 | 0 : $214;
    $$0$$us$i = ($232 & 1 ^ 1) + $$011$us$i | 0;
    HEAP16[$225 >> 1] = $$$us$i;
    if (($224 | 0) <= ($$idx101$val | 0)) {
     $237 = $0 + 2876 + ($$$us$i << 1) | 0;
     HEAP16[$237 >> 1] = (HEAP16[$237 >> 1] | 0) + 1 << 16 >> 16;
     if (($224 | 0) < ($212 | 0)) $$0111$us$i = 0; else $$0111$us$i = HEAP32[$210 + ($224 - $212 << 2) >> 2] | 0;
     $248 = Math_imul(HEAPU16[$$idx$val + ($224 << 2) >> 1] | 0, $$0111$us$i + $$$us$i | 0) | 0;
     HEAP32[$220 >> 2] = $248 + (HEAP32[$220 >> 2] | 0);
    }
    $$010812$us$i = $$010812$us$i + 1 | 0;
    if (($$010812$us$i | 0) == 573) {
     $$0$lcssa$i = $$0$$us$i;
     break;
    } else $$011$us$i = $$0$$us$i;
   }
  } else {
   $$010812$i = $$010810$i;
   $$011$i = 0;
   while (1) {
    $252 = HEAP32[$0 + 2908 + ($$010812$i << 2) >> 2] | 0;
    $253 = $$idx$val + ($252 << 2) + 2 | 0;
    $258 = HEAPU16[$$idx$val + (HEAPU16[$253 >> 1] << 2) + 2 >> 1] | 0;
    $260 = ($258 | 0) < ($214 | 0);
    $$$i = $260 ? $258 + 1 | 0 : $214;
    $$0$$i = ($260 & 1 ^ 1) + $$011$i | 0;
    HEAP16[$253 >> 1] = $$$i;
    if (($252 | 0) <= ($$idx101$val | 0)) {
     $265 = $0 + 2876 + ($$$i << 1) | 0;
     HEAP16[$265 >> 1] = (HEAP16[$265 >> 1] | 0) + 1 << 16 >> 16;
     if (($252 | 0) < ($212 | 0)) $$0111$i = 0; else $$0111$i = HEAP32[$210 + ($252 - $212 << 2) >> 2] | 0;
     $274 = HEAPU16[$$idx$val + ($252 << 2) >> 1] | 0;
     $276 = Math_imul($274, $$0111$i + $$$i | 0) | 0;
     HEAP32[$220 >> 2] = $276 + (HEAP32[$220 >> 2] | 0);
     $283 = Math_imul((HEAPU16[$208 + ($252 << 2) + 2 >> 1] | 0) + $$0111$i | 0, $274) | 0;
     HEAP32[$222 >> 2] = $283 + (HEAP32[$222 >> 2] | 0);
    }
    $$010812$i = $$010812$i + 1 | 0;
    if (($$010812$i | 0) == 573) {
     $$0$lcssa$i = $$0$$i;
     break;
    } else $$011$i = $$0$$i;
   }
  }
  if ($$0$lcssa$i | 0) {
   $287 = $0 + 2876 + ($214 << 1) | 0;
   $$2$i = $$0$lcssa$i;
   while (1) {
    $$2114$in$i = $214;
    while (1) {
     $$2114$i = $$2114$in$i + -1 | 0;
     $288 = $0 + 2876 + ($$2114$i << 1) | 0;
     $289 = HEAP16[$288 >> 1] | 0;
     if (!($289 << 16 >> 16)) $$2114$in$i = $$2114$i; else break;
    }
    HEAP16[$288 >> 1] = $289 + -1 << 16 >> 16;
    $292 = $0 + 2876 + ($$2114$in$i << 1) | 0;
    HEAP16[$292 >> 1] = (HEAPU16[$292 >> 1] | 0) + 2;
    $298 = (HEAP16[$287 >> 1] | 0) + -1 << 16 >> 16;
    HEAP16[$287 >> 1] = $298;
    if (($$2$i | 0) > 2) $$2$i = $$2$i + -2 | 0; else break;
   }
   if ($214 | 0) {
    $$11099$i = 573;
    $$37$i = $214;
    $303 = $298;
    while (1) {
     $302 = $$37$i & 65535;
     if (!($303 << 16 >> 16)) $$2110$ph$i$lcssa = $$11099$i; else {
      $$0115$ph$i131 = $303 & 65535;
      $$2110$ph$i132 = $$11099$i;
      while (1) {
       $$2110$i = $$2110$ph$i132;
       do {
        $$2110$i = $$2110$i + -1 | 0;
        $308 = HEAP32[$0 + 2908 + ($$2110$i << 2) >> 2] | 0;
       } while (($308 | 0) > ($$idx101$val | 0));
       $310 = $$idx$val + ($308 << 2) + 2 | 0;
       $312 = HEAPU16[$310 >> 1] | 0;
       if (($$37$i | 0) != ($312 | 0)) {
        $318 = Math_imul(HEAPU16[$$idx$val + ($308 << 2) >> 1] | 0, $$37$i - $312 | 0) | 0;
        HEAP32[$220 >> 2] = $318 + (HEAP32[$220 >> 2] | 0);
        HEAP16[$310 >> 1] = $302;
       }
       $$0115$ph$i131 = $$0115$ph$i131 + -1 | 0;
       if (!$$0115$ph$i131) {
        $$2110$ph$i$lcssa = $$2110$i;
        break;
       } else $$2110$ph$i132 = $$2110$i;
      }
     }
     $323 = $$37$i + -1 | 0;
     if (!$323) break L71;
     $$11099$i = $$2110$ph$i$lcssa;
     $$37$i = $323;
     $303 = HEAP16[$0 + 2876 + ($323 << 1) >> 1] | 0;
    }
   }
  }
 } while (0);
 $$02430$i = 0;
 $$02629$i = 1;
 do {
  $$02430$i = (HEAPU16[$0 + 2876 + ($$02629$i + -1 << 1) >> 1] | 0) + $$02430$i << 1;
  HEAP16[$2 + ($$02629$i << 1) >> 1] = $$02430$i;
  $$02629$i = $$02629$i + 1 | 0;
 } while (($$02629$i | 0) != 16);
 if (($$2$lcssa | 0) < 0) {
  STACKTOP = sp;
  return;
 } else $$02527$i = 0;
 while (1) {
  $336 = HEAP16[$3 + ($$02527$i << 2) + 2 >> 1] | 0;
  $337 = $336 & 65535;
  if ($336 << 16 >> 16) {
   $339 = $2 + ($337 << 1) | 0;
   $340 = HEAP16[$339 >> 1] | 0;
   HEAP16[$339 >> 1] = $340 + 1 << 16 >> 16;
   $$0$i$i = 0;
   $$07$i$i = $337;
   $$08$i$i = $340 & 65535;
   while (1) {
    $344 = $$0$i$i | $$08$i$i & 1;
    if (($$07$i$i | 0) > 1) {
     $$0$i$i = $344 << 1;
     $$07$i$i = $$07$i$i + -1 | 0;
     $$08$i$i = $$08$i$i >>> 1;
    } else break;
   }
   HEAP16[$3 + ($$02527$i << 2) >> 1] = $344;
  }
  if (($$02527$i | 0) == ($$2$lcssa | 0)) break; else $$02527$i = $$02527$i + 1 | 0;
 }
 STACKTOP = sp;
 return;
}

function __tr_flush_block($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $$0 = 0, $$0$lcssa$i = 0, $$0118$i = 0, $$01620$i = 0, $$017$i = 0, $$021$i = 0, $$046$i$i = 0, $$046$i24$i = 0, $$048$ph$i$i = 0, $$048$ph$i19$i = 0, $$049$i$i = 0, $$049$i23$i = 0, $$049$ph$i$i = 0, $$049$ph$i18$i = 0, $$050$ph$i$i = 0, $$050$ph$i$i$phi = 0, $$050$ph$i17$i = 0, $$050$ph$i17$i$phi = 0, $$092 = 0, $$093 = 0, $$1$ph$i$i = 0, $$1$ph$i21$i = 0, $$119$i = 0, $$144$ph$i$i = 0, $$144$ph$i20$i = 0, $$pre$phi$iZ2D = 0, $$pre$phi117Z2D = 0, $$pre$phiZ2D = 0, $108 = 0, $161 = 0, $163 = 0, $165 = 0, $169 = 0, $171 = 0, $179 = 0, $180 = 0, $181 = 0, $183 = 0, $185 = 0, $188 = 0, $191 = 0, $192 = 0, $194 = 0, $199 = 0, $200 = 0, $204 = 0, $211 = 0, $213 = 0, $216 = 0, $219 = 0, $220 = 0, $222 = 0, $227 = 0, $228 = 0, $232 = 0, $234 = 0, $239 = 0, $241 = 0, $244 = 0, $247 = 0, $248 = 0, $251 = 0, $252 = 0, $254 = 0, $259 = 0, $260 = 0, $264 = 0, $266 = 0, $270 = 0, $272 = 0, $275 = 0, $276 = 0, $279 = 0, $280 = 0, $282 = 0, $287 = 0, $288 = 0, $292 = 0, $294 = 0, $298 = 0, $301 = 0, $304 = 0, $305 = 0, $308 = 0, $309 = 0, $311 = 0, $316 = 0, $317 = 0, $321 = 0, $323 = 0, $327 = 0, $334 = 0, $337 = 0, $338 = 0, $341 = 0, $347 = 0, $348 = 0, $352 = 0, $354 = 0, $359 = 0, $36 = 0, $360 = 0, $362 = 0, $363 = 0, $365 = 0, $367 = 0, $368 = 0, $369 = 0, $371 = 0, $376 = 0, $377 = 0, $38 = 0, $382 = 0, $384 = 0, $385 = 0, $386 = 0, $391 = 0, $392 = 0, $40 = 0, $43 = 0, $44 = 0, $45 = 0, $49 = 0, $50 = 0, $53 = 0, $55 = 0, $62 = 0, $72 = 0, $75 = 0, $77 = 0, $79 = 0, $8 = 0, $85 = 0, $86 = 0, $89 = 0, $91 = 0, $98 = 0, $storemerge = 0, $storemerge116$i = 0, $storemerge117$i = 0, $storemerge94 = 0, label = 0;
 if ((HEAP32[$0 + 132 >> 2] | 0) > 0) {
  $8 = (HEAP32[$0 >> 2] | 0) + 44 | 0;
  if ((HEAP32[$8 >> 2] | 0) == 2) {
   $$01620$i = -201342849;
   $$021$i = 0;
   while (1) {
    if ($$01620$i & 1 | 0) if (HEAP16[$0 + 148 + ($$021$i << 2) >> 1] | 0) {
     $$017$i = 0;
     break;
    }
    $$021$i = $$021$i + 1 | 0;
    if (($$021$i | 0) >= 32) {
     label = 6;
     break;
    } else $$01620$i = $$01620$i >>> 1;
   }
   L9 : do if ((label | 0) == 6) if (!(HEAP16[$0 + 184 >> 1] | 0)) if (!(HEAP16[$0 + 188 >> 1] | 0)) if (!(HEAP16[$0 + 200 >> 1] | 0)) {
    $$119$i = 32;
    while (1) {
     if (HEAP16[$0 + 148 + ($$119$i << 2) >> 1] | 0) {
      $$017$i = 1;
      break L9;
     }
     $$119$i = $$119$i + 1 | 0;
     if (($$119$i | 0) >= 256) {
      $$017$i = 0;
      break;
     }
    }
   } else $$017$i = 1; else $$017$i = 1; else $$017$i = 1; while (0);
   HEAP32[$8 >> 2] = $$017$i;
  }
  _build_tree($0, $0 + 2840 | 0);
  _build_tree($0, $0 + 2852 | 0);
  $36 = HEAP32[$0 + 2844 >> 2] | 0;
  $38 = HEAP16[$0 + 150 >> 1] | 0;
  $40 = $38 << 16 >> 16 == 0;
  HEAP16[$0 + 148 + ($36 + 1 << 2) + 2 >> 1] = -1;
  $43 = $0 + 2752 | 0;
  $44 = $0 + 2756 | 0;
  $45 = $0 + 2748 | 0;
  $$048$ph$i$i = $38 & 65535;
  $$049$ph$i$i = 0;
  $$050$ph$i$i = -1;
  $$1$ph$i$i = $40 ? 3 : 4;
  $$144$ph$i$i = $40 ? 138 : 7;
  L18 : while (1) {
   $$046$i$i = 0;
   $$049$i$i = $$049$ph$i$i;
   do {
    if (($$049$i$i | 0) > ($36 | 0)) break L18;
    $$049$i$i = $$049$i$i + 1 | 0;
    $49 = HEAP16[$0 + 148 + ($$049$i$i << 2) + 2 >> 1] | 0;
    $50 = $49 & 65535;
    $$046$i$i = $$046$i$i + 1 | 0;
    $53 = ($$048$ph$i$i | 0) == ($50 | 0);
   } while (($$046$i$i | 0) < ($$144$ph$i$i | 0) & $53);
   do if (($$046$i$i | 0) < ($$1$ph$i$i | 0)) {
    $55 = $0 + 2684 + ($$048$ph$i$i << 2) | 0;
    HEAP16[$55 >> 1] = (HEAPU16[$55 >> 1] | 0) + $$046$i$i;
   } else if (!$$048$ph$i$i) if (($$046$i$i | 0) < 11) {
    HEAP16[$43 >> 1] = (HEAP16[$43 >> 1] | 0) + 1 << 16 >> 16;
    break;
   } else {
    HEAP16[$44 >> 1] = (HEAP16[$44 >> 1] | 0) + 1 << 16 >> 16;
    break;
   } else {
    $62 = $0 + 2684 + ($$048$ph$i$i << 2) | 0;
    if (($$048$ph$i$i | 0) != ($$050$ph$i$i | 0)) HEAP16[$62 >> 1] = (HEAP16[$62 >> 1] | 0) + 1 << 16 >> 16;
    HEAP16[$45 >> 1] = (HEAP16[$45 >> 1] | 0) + 1 << 16 >> 16;
    break;
   } while (0);
   $72 = $49 << 16 >> 16 == 0;
   $$050$ph$i$i$phi = $$048$ph$i$i;
   $$048$ph$i$i = $50;
   $$049$ph$i$i = $$049$i$i;
   $$1$ph$i$i = $72 | $53 ? 3 : 4;
   $$144$ph$i$i = $72 ? 138 : $53 ? 6 : 7;
   $$050$ph$i$i = $$050$ph$i$i$phi;
  }
  $75 = HEAP32[$0 + 2856 >> 2] | 0;
  $77 = HEAP16[$0 + 2442 >> 1] | 0;
  $79 = $77 << 16 >> 16 == 0;
  HEAP16[$0 + 2440 + ($75 + 1 << 2) + 2 >> 1] = -1;
  $$048$ph$i19$i = $77 & 65535;
  $$049$ph$i18$i = 0;
  $$050$ph$i17$i = -1;
  $$1$ph$i21$i = $79 ? 3 : 4;
  $$144$ph$i20$i = $79 ? 138 : 7;
  L38 : while (1) {
   $$046$i24$i = 0;
   $$049$i23$i = $$049$ph$i18$i;
   do {
    if (($$049$i23$i | 0) > ($75 | 0)) break L38;
    $$049$i23$i = $$049$i23$i + 1 | 0;
    $85 = HEAP16[$0 + 2440 + ($$049$i23$i << 2) + 2 >> 1] | 0;
    $86 = $85 & 65535;
    $$046$i24$i = $$046$i24$i + 1 | 0;
    $89 = ($$048$ph$i19$i | 0) == ($86 | 0);
   } while (($$046$i24$i | 0) < ($$144$ph$i20$i | 0) & $89);
   do if (($$046$i24$i | 0) < ($$1$ph$i21$i | 0)) {
    $91 = $0 + 2684 + ($$048$ph$i19$i << 2) | 0;
    HEAP16[$91 >> 1] = (HEAPU16[$91 >> 1] | 0) + $$046$i24$i;
   } else if (!$$048$ph$i19$i) if (($$046$i24$i | 0) < 11) {
    HEAP16[$43 >> 1] = (HEAP16[$43 >> 1] | 0) + 1 << 16 >> 16;
    break;
   } else {
    HEAP16[$44 >> 1] = (HEAP16[$44 >> 1] | 0) + 1 << 16 >> 16;
    break;
   } else {
    $98 = $0 + 2684 + ($$048$ph$i19$i << 2) | 0;
    if (($$048$ph$i19$i | 0) != ($$050$ph$i17$i | 0)) HEAP16[$98 >> 1] = (HEAP16[$98 >> 1] | 0) + 1 << 16 >> 16;
    HEAP16[$45 >> 1] = (HEAP16[$45 >> 1] | 0) + 1 << 16 >> 16;
    break;
   } while (0);
   $108 = $85 << 16 >> 16 == 0;
   $$050$ph$i17$i$phi = $$048$ph$i19$i;
   $$048$ph$i19$i = $86;
   $$049$ph$i18$i = $$049$i23$i;
   $$1$ph$i21$i = $108 | $89 ? 3 : 4;
   $$144$ph$i20$i = $108 ? 138 : $89 ? 6 : 7;
   $$050$ph$i17$i = $$050$ph$i17$i$phi;
  }
  _build_tree($0, $0 + 2864 | 0);
  if (!(HEAP16[$0 + 2746 >> 1] | 0)) if (!(HEAP16[$0 + 2690 >> 1] | 0)) if (!(HEAP16[$0 + 2742 >> 1] | 0)) if (!(HEAP16[$0 + 2694 >> 1] | 0)) if (!(HEAP16[$0 + 2738 >> 1] | 0)) if (!(HEAP16[$0 + 2698 >> 1] | 0)) if (!(HEAP16[$0 + 2734 >> 1] | 0)) if (!(HEAP16[$0 + 2702 >> 1] | 0)) if (!(HEAP16[$0 + 2730 >> 1] | 0)) if (!(HEAP16[$0 + 2706 >> 1] | 0)) if (!(HEAP16[$0 + 2726 >> 1] | 0)) if (!(HEAP16[$0 + 2710 >> 1] | 0)) if (!(HEAP16[$0 + 2722 >> 1] | 0)) if (!(HEAP16[$0 + 2714 >> 1] | 0)) if (!(HEAP16[$0 + 2718 >> 1] | 0)) $$0$lcssa$i = (HEAP16[$0 + 2686 >> 1] | 0) == 0 ? 2 : 3; else $$0$lcssa$i = 4; else $$0$lcssa$i = 5; else $$0$lcssa$i = 6; else $$0$lcssa$i = 7; else $$0$lcssa$i = 8; else $$0$lcssa$i = 9; else $$0$lcssa$i = 10; else $$0$lcssa$i = 11; else $$0$lcssa$i = 12; else $$0$lcssa$i = 13; else $$0$lcssa$i = 14; else $$0$lcssa$i = 15; else $$0$lcssa$i = 16; else $$0$lcssa$i = 17; else $$0$lcssa$i = 18;
  $161 = $0 + 5800 | 0;
  $163 = ($$0$lcssa$i * 3 | 0) + 17 + (HEAP32[$161 >> 2] | 0) | 0;
  HEAP32[$161 >> 2] = $163;
  $165 = ($163 + 10 | 0) >>> 3;
  $169 = ((HEAP32[$0 + 5804 >> 2] | 0) + 10 | 0) >>> 3;
  $$0 = $169 >>> 0 > $165 >>> 0 ? $165 : $169;
  $$092 = $169;
  $$093 = $$0$lcssa$i;
 } else {
  $171 = $2 + 5 | 0;
  $$0 = $171;
  $$092 = $171;
  $$093 = 0;
 }
 do if (($1 | 0) != 0 & ($2 + 4 | 0) >>> 0 <= $$0 >>> 0) __tr_stored_block($0, $1, $2, $3); else {
  $179 = $0 + 5820 | 0;
  $180 = HEAP32[$179 >> 2] | 0;
  $181 = ($180 | 0) > 13;
  if (($$092 | 0) == ($$0 | 0) ? 1 : (HEAP32[$0 + 136 >> 2] | 0) == 4) {
   $183 = $3 + 2 & 65535;
   $185 = $0 + 5816 | 0;
   $188 = HEAPU16[$185 >> 1] | $183 << $180;
   HEAP16[$185 >> 1] = $188;
   if ($181) {
    $191 = $0 + 20 | 0;
    $192 = HEAP32[$191 >> 2] | 0;
    HEAP32[$191 >> 2] = $192 + 1;
    $194 = $0 + 8 | 0;
    HEAP8[(HEAP32[$194 >> 2] | 0) + $192 >> 0] = $188;
    $199 = (HEAPU16[$185 >> 1] | 0) >>> 8 & 255;
    $200 = HEAP32[$191 >> 2] | 0;
    HEAP32[$191 >> 2] = $200 + 1;
    HEAP8[(HEAP32[$194 >> 2] | 0) + $200 >> 0] = $199;
    $204 = HEAP32[$179 >> 2] | 0;
    HEAP16[$185 >> 1] = $183 >>> (16 - $204 | 0);
    $storemerge94 = $204 + -13 | 0;
   } else $storemerge94 = $180 + 3 | 0;
   HEAP32[$179 >> 2] = $storemerge94;
   _compress_block($0, 10636, 10516);
   break;
  }
  $211 = $3 + 4 & 65535;
  $213 = $0 + 5816 | 0;
  $216 = HEAPU16[$213 >> 1] | $211 << $180;
  HEAP16[$213 >> 1] = $216;
  if ($181) {
   $219 = $0 + 20 | 0;
   $220 = HEAP32[$219 >> 2] | 0;
   HEAP32[$219 >> 2] = $220 + 1;
   $222 = $0 + 8 | 0;
   HEAP8[(HEAP32[$222 >> 2] | 0) + $220 >> 0] = $216;
   $227 = (HEAPU16[$213 >> 1] | 0) >>> 8 & 255;
   $228 = HEAP32[$219 >> 2] | 0;
   HEAP32[$219 >> 2] = $228 + 1;
   HEAP8[(HEAP32[$222 >> 2] | 0) + $228 >> 0] = $227;
   $232 = HEAP32[$179 >> 2] | 0;
   $234 = $211 >>> (16 - $232 | 0);
   HEAP16[$213 >> 1] = $234;
   $247 = $234;
   $storemerge = $232 + -13 | 0;
  } else {
   $247 = $216;
   $storemerge = $180 + 3 | 0;
  }
  HEAP32[$179 >> 2] = $storemerge;
  $239 = HEAP32[$0 + 2844 >> 2] | 0;
  $241 = HEAP32[$0 + 2856 >> 2] | 0;
  $244 = $239 + 65280 & 65535;
  $248 = $247 & 65535 | $244 << $storemerge;
  HEAP16[$213 >> 1] = $248;
  if (($storemerge | 0) > 11) {
   $251 = $0 + 20 | 0;
   $252 = HEAP32[$251 >> 2] | 0;
   HEAP32[$251 >> 2] = $252 + 1;
   $254 = $0 + 8 | 0;
   HEAP8[(HEAP32[$254 >> 2] | 0) + $252 >> 0] = $248;
   $259 = (HEAPU16[$213 >> 1] | 0) >>> 8 & 255;
   $260 = HEAP32[$251 >> 2] | 0;
   HEAP32[$251 >> 2] = $260 + 1;
   HEAP8[(HEAP32[$254 >> 2] | 0) + $260 >> 0] = $259;
   $264 = HEAP32[$179 >> 2] | 0;
   $266 = $244 >>> (16 - $264 | 0);
   HEAP16[$213 >> 1] = $266;
   $270 = $264 + -11 | 0;
   $275 = $266;
  } else {
   $270 = $storemerge + 5 | 0;
   $275 = $248;
  }
  HEAP32[$179 >> 2] = $270;
  $272 = $241 & 65535;
  $276 = $272 << $270 | $275 & 65535;
  HEAP16[$213 >> 1] = $276;
  if (($270 | 0) > 11) {
   $279 = $0 + 20 | 0;
   $280 = HEAP32[$279 >> 2] | 0;
   HEAP32[$279 >> 2] = $280 + 1;
   $282 = $0 + 8 | 0;
   HEAP8[(HEAP32[$282 >> 2] | 0) + $280 >> 0] = $276;
   $287 = (HEAPU16[$213 >> 1] | 0) >>> 8 & 255;
   $288 = HEAP32[$279 >> 2] | 0;
   HEAP32[$279 >> 2] = $288 + 1;
   HEAP8[(HEAP32[$282 >> 2] | 0) + $288 >> 0] = $287;
   $292 = HEAP32[$179 >> 2] | 0;
   $294 = $272 >>> (16 - $292 | 0);
   HEAP16[$213 >> 1] = $294;
   $298 = $292 + -11 | 0;
   $304 = $294;
  } else {
   $298 = $270 + 5 | 0;
   $304 = $276;
  }
  HEAP32[$179 >> 2] = $298;
  $301 = $$093 + 65533 & 65535;
  $305 = $301 << $298 | $304 & 65535;
  HEAP16[$213 >> 1] = $305;
  if (($298 | 0) > 12) {
   $308 = $0 + 20 | 0;
   $309 = HEAP32[$308 >> 2] | 0;
   HEAP32[$308 >> 2] = $309 + 1;
   $311 = $0 + 8 | 0;
   HEAP8[(HEAP32[$311 >> 2] | 0) + $309 >> 0] = $305;
   $316 = (HEAPU16[$213 >> 1] | 0) >>> 8 & 255;
   $317 = HEAP32[$308 >> 2] | 0;
   HEAP32[$308 >> 2] = $317 + 1;
   HEAP8[(HEAP32[$311 >> 2] | 0) + $317 >> 0] = $316;
   $321 = HEAP32[$179 >> 2] | 0;
   $323 = $301 >>> (16 - $321 | 0);
   HEAP16[$213 >> 1] = $323;
   $$pre$phi117Z2D = $311;
   $$pre$phiZ2D = $308;
   $391 = $323;
   $storemerge116$i = $321 + -12 | 0;
  } else {
   $$pre$phi117Z2D = $0 + 8 | 0;
   $$pre$phiZ2D = $0 + 20 | 0;
   $391 = $305;
   $storemerge116$i = $298 + 4 | 0;
  }
  HEAP32[$179 >> 2] = $storemerge116$i;
  $$0118$i = 0;
  $327 = $storemerge116$i;
  $337 = $391;
  while (1) {
   $334 = HEAPU16[$0 + 2684 + (HEAPU8[13268 + $$0118$i >> 0] << 2) + 2 >> 1] | 0;
   $338 = $334 << $327 | $337 & 65535;
   HEAP16[$213 >> 1] = $338;
   if (($327 | 0) > 13) {
    $341 = HEAP32[$$pre$phiZ2D >> 2] | 0;
    HEAP32[$$pre$phiZ2D >> 2] = $341 + 1;
    HEAP8[(HEAP32[$$pre$phi117Z2D >> 2] | 0) + $341 >> 0] = $338;
    $347 = (HEAPU16[$213 >> 1] | 0) >>> 8 & 255;
    $348 = HEAP32[$$pre$phiZ2D >> 2] | 0;
    HEAP32[$$pre$phiZ2D >> 2] = $348 + 1;
    HEAP8[(HEAP32[$$pre$phi117Z2D >> 2] | 0) + $348 >> 0] = $347;
    $352 = HEAP32[$179 >> 2] | 0;
    $354 = $334 >>> (16 - $352 | 0);
    HEAP16[$213 >> 1] = $354;
    $392 = $354;
    $storemerge117$i = $352 + -13 | 0;
   } else {
    $392 = $338;
    $storemerge117$i = $327 + 3 | 0;
   }
   HEAP32[$179 >> 2] = $storemerge117$i;
   if (($$0118$i | 0) == ($$093 | 0)) break; else {
    $$0118$i = $$0118$i + 1 | 0;
    $327 = $storemerge117$i;
    $337 = $392;
   }
  }
  $359 = $0 + 148 | 0;
  _send_tree($0, $359, $239);
  $360 = $0 + 2440 | 0;
  _send_tree($0, $360, $241);
  _compress_block($0, $359, $360);
 } while (0);
 _init_block($0);
 if (!$3) return;
 $362 = $0 + 5820 | 0;
 $363 = HEAP32[$362 >> 2] | 0;
 if (($363 | 0) > 8) {
  $365 = $0 + 5816 | 0;
  $367 = HEAP16[$365 >> 1] & 255;
  $368 = $0 + 20 | 0;
  $369 = HEAP32[$368 >> 2] | 0;
  HEAP32[$368 >> 2] = $369 + 1;
  $371 = $0 + 8 | 0;
  HEAP8[(HEAP32[$371 >> 2] | 0) + $369 >> 0] = $367;
  $376 = (HEAPU16[$365 >> 1] | 0) >>> 8 & 255;
  $377 = HEAP32[$368 >> 2] | 0;
  HEAP32[$368 >> 2] = $377 + 1;
  HEAP8[(HEAP32[$371 >> 2] | 0) + $377 >> 0] = $376;
  $$pre$phi$iZ2D = $365;
 } else {
  $382 = $0 + 5816 | 0;
  if (($363 | 0) > 0) {
   $384 = HEAP16[$382 >> 1] & 255;
   $385 = $0 + 20 | 0;
   $386 = HEAP32[$385 >> 2] | 0;
   HEAP32[$385 >> 2] = $386 + 1;
   HEAP8[(HEAP32[$0 + 8 >> 2] | 0) + $386 >> 0] = $384;
   $$pre$phi$iZ2D = $382;
  } else $$pre$phi$iZ2D = $382;
 }
 HEAP16[$$pre$phi$iZ2D >> 1] = 0;
 HEAP32[$362 >> 2] = 0;
 return;
}

function __Z11encodeShortRNSt3__26vectorIbNS_9allocatorIbEEEEs($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0 = 0, $$0$i = 0, $$0$in$i = 0, $$043160 = 0, $$046 = 0, $$pre$phi161Z2D = 0, $$pre$phi162Z2D = 0, $$pre$phiZ2D = 0, $101 = 0, $106 = 0, $107 = 0, $11 = 0, $114 = 0, $116 = 0, $119 = 0, $12 = 0, $122 = 0, $127 = 0, $128 = 0, $13 = 0, $135 = 0, $137 = 0, $14 = 0, $140 = 0, $141 = 0, $143 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $161 = 0, $163 = 0, $166 = 0, $169 = 0, $174 = 0, $175 = 0, $182 = 0, $184 = 0, $187 = 0, $190 = 0, $195 = 0, $196 = 0, $2 = 0, $203 = 0, $205 = 0, $208 = 0, $21 = 0, $211 = 0, $216 = 0, $217 = 0, $224 = 0, $226 = 0, $229 = 0, $23 = 0, $230 = 0, $232 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $250 = 0, $252 = 0, $255 = 0, $258 = 0, $26 = 0, $263 = 0, $264 = 0, $27 = 0, $271 = 0, $273 = 0, $276 = 0, $279 = 0, $284 = 0, $285 = 0, $29 = 0, $292 = 0, $294 = 0, $297 = 0, $300 = 0, $305 = 0, $306 = 0, $313 = 0, $315 = 0, $318 = 0, $319 = 0, $321 = 0, $327 = 0, $328 = 0, $331 = 0, $332 = 0, $333 = 0, $340 = 0, $342 = 0, $345 = 0, $347 = 0, $348 = 0, $350 = 0, $358 = 0, $359 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $46 = 0, $48 = 0, $51 = 0, $54 = 0, $59 = 0, $60 = 0, $67 = 0, $69 = 0, $7 = 0, $72 = 0, $73 = 0, $75 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $9 = 0, $93 = 0, $95 = 0, $98 = 0, $storemerge$i$i = 0, label = 0;
 $2 = $1 << 16 >> 16;
 if ($1 << 16 >> 16 < 0) $$0$in$i = 0 - $2 << 1 | 1; else $$0$in$i = $2 << 1;
 $$0$i = $$0$in$i & 65535;
 $7 = $$0$in$i << 16 >> 16;
 if ($$0$i << 16 >> 16 < 0) {
  $9 = ___cxa_allocate_exception(8) | 0;
  __ZNSt13runtime_errorC2EPKc($9, 12369);
  ___cxa_throw($9 | 0, 440, 8);
 }
 do if ($$0$i << 16 >> 16 < 8) {
  $11 = $0 + 4 | 0;
  $12 = HEAP32[$11 >> 2] | 0;
  $13 = $0 + 8 | 0;
  $14 = HEAP32[$13 >> 2] | 0;
  do if (($12 | 0) == ($14 << 5 | 0)) if (($12 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
   $21 = $14 << 6;
   $23 = $12 + 32 & -32;
   __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $14 << 5 >>> 0 < 1073741823 ? ($21 >>> 0 < $23 >>> 0 ? $23 : $21) : 2147483647);
   $26 = HEAP32[$11 >> 2] | 0;
   break;
  } else $26 = $12; while (0);
  HEAP32[$11 >> 2] = $26 + 1;
  $27 = HEAP32[$0 >> 2] | 0;
  $29 = $27 + ($26 >>> 5 << 2) | 0;
  HEAP32[$29 >> 2] = HEAP32[$29 >> 2] & ~(1 << ($26 & 31));
  $$0 = $$0$in$i;
  $$046 = 3;
  $$pre$phi161Z2D = $13;
  $$pre$phi162Z2D = $0;
  $$pre$phiZ2D = $11;
  $358 = $27;
 } else {
  if ($$0$i << 16 >> 16 < 40) {
   $36 = $0 + 4 | 0;
   $37 = HEAP32[$36 >> 2] | 0;
   $38 = $0 + 8 | 0;
   $39 = HEAP32[$38 >> 2] | 0;
   do if (($37 | 0) == ($39 << 5 | 0)) if (($37 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
    $46 = $39 << 6;
    $48 = $37 + 32 & -32;
    __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $39 << 5 >>> 0 < 1073741823 ? ($46 >>> 0 < $48 >>> 0 ? $48 : $46) : 2147483647);
    $51 = HEAP32[$36 >> 2] | 0;
    break;
   } else $51 = $37; while (0);
   HEAP32[$36 >> 2] = $51 + 1;
   $54 = (HEAP32[$0 >> 2] | 0) + ($51 >>> 5 << 2) | 0;
   HEAP32[$54 >> 2] = HEAP32[$54 >> 2] | 1 << ($51 & 31);
   $59 = HEAP32[$36 >> 2] | 0;
   $60 = HEAP32[$38 >> 2] | 0;
   do if (($59 | 0) == ($60 << 5 | 0)) if (($59 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
    $67 = $60 << 6;
    $69 = $59 + 32 & -32;
    __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $60 << 5 >>> 0 < 1073741823 ? ($67 >>> 0 < $69 >>> 0 ? $69 : $67) : 2147483647);
    $72 = HEAP32[$36 >> 2] | 0;
    break;
   } else $72 = $59; while (0);
   HEAP32[$36 >> 2] = $72 + 1;
   $73 = HEAP32[$0 >> 2] | 0;
   $75 = $73 + ($72 >>> 5 << 2) | 0;
   HEAP32[$75 >> 2] = HEAP32[$75 >> 2] & ~(1 << ($72 & 31));
   $$0 = $7 + 65528 | 0;
   $$046 = 5;
   $$pre$phi161Z2D = $38;
   $$pre$phi162Z2D = $0;
   $$pre$phiZ2D = $36;
   $358 = $73;
   break;
  }
  if ($$0$i << 16 >> 16 < 168) {
   $83 = $0 + 4 | 0;
   $84 = HEAP32[$83 >> 2] | 0;
   $85 = $0 + 8 | 0;
   $86 = HEAP32[$85 >> 2] | 0;
   do if (($84 | 0) == ($86 << 5 | 0)) if (($84 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
    $93 = $86 << 6;
    $95 = $84 + 32 & -32;
    __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $86 << 5 >>> 0 < 1073741823 ? ($93 >>> 0 < $95 >>> 0 ? $95 : $93) : 2147483647);
    $98 = HEAP32[$83 >> 2] | 0;
    break;
   } else $98 = $84; while (0);
   HEAP32[$83 >> 2] = $98 + 1;
   $101 = (HEAP32[$0 >> 2] | 0) + ($98 >>> 5 << 2) | 0;
   HEAP32[$101 >> 2] = HEAP32[$101 >> 2] | 1 << ($98 & 31);
   $106 = HEAP32[$83 >> 2] | 0;
   $107 = HEAP32[$85 >> 2] | 0;
   do if (($106 | 0) == ($107 << 5 | 0)) if (($106 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
    $114 = $107 << 6;
    $116 = $106 + 32 & -32;
    __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $107 << 5 >>> 0 < 1073741823 ? ($114 >>> 0 < $116 >>> 0 ? $116 : $114) : 2147483647);
    $119 = HEAP32[$83 >> 2] | 0;
    break;
   } else $119 = $106; while (0);
   HEAP32[$83 >> 2] = $119 + 1;
   $122 = (HEAP32[$0 >> 2] | 0) + ($119 >>> 5 << 2) | 0;
   HEAP32[$122 >> 2] = HEAP32[$122 >> 2] | 1 << ($119 & 31);
   $127 = HEAP32[$83 >> 2] | 0;
   $128 = HEAP32[$85 >> 2] | 0;
   do if (($127 | 0) == ($128 << 5 | 0)) if (($127 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
    $135 = $128 << 6;
    $137 = $127 + 32 & -32;
    __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $128 << 5 >>> 0 < 1073741823 ? ($135 >>> 0 < $137 >>> 0 ? $137 : $135) : 2147483647);
    $140 = HEAP32[$83 >> 2] | 0;
    break;
   } else $140 = $127; while (0);
   HEAP32[$83 >> 2] = $140 + 1;
   $141 = HEAP32[$0 >> 2] | 0;
   $143 = $141 + ($140 >>> 5 << 2) | 0;
   HEAP32[$143 >> 2] = HEAP32[$143 >> 2] & ~(1 << ($140 & 31));
   $$0 = $7 + 65496 | 0;
   $$046 = 7;
   $$pre$phi161Z2D = $85;
   $$pre$phi162Z2D = $0;
   $$pre$phiZ2D = $83;
   $358 = $141;
   break;
  }
  if ($$0$i << 16 >> 16 < 680) {
   $151 = $0 + 4 | 0;
   $152 = HEAP32[$151 >> 2] | 0;
   $153 = $0 + 8 | 0;
   $154 = HEAP32[$153 >> 2] | 0;
   do if (($152 | 0) == ($154 << 5 | 0)) if (($152 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
    $161 = $154 << 6;
    $163 = $152 + 32 & -32;
    __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $154 << 5 >>> 0 < 1073741823 ? ($161 >>> 0 < $163 >>> 0 ? $163 : $161) : 2147483647);
    $166 = HEAP32[$151 >> 2] | 0;
    break;
   } else $166 = $152; while (0);
   HEAP32[$151 >> 2] = $166 + 1;
   $169 = (HEAP32[$0 >> 2] | 0) + ($166 >>> 5 << 2) | 0;
   HEAP32[$169 >> 2] = HEAP32[$169 >> 2] | 1 << ($166 & 31);
   $174 = HEAP32[$151 >> 2] | 0;
   $175 = HEAP32[$153 >> 2] | 0;
   do if (($174 | 0) == ($175 << 5 | 0)) if (($174 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
    $182 = $175 << 6;
    $184 = $174 + 32 & -32;
    __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $175 << 5 >>> 0 < 1073741823 ? ($182 >>> 0 < $184 >>> 0 ? $184 : $182) : 2147483647);
    $187 = HEAP32[$151 >> 2] | 0;
    break;
   } else $187 = $174; while (0);
   HEAP32[$151 >> 2] = $187 + 1;
   $190 = (HEAP32[$0 >> 2] | 0) + ($187 >>> 5 << 2) | 0;
   HEAP32[$190 >> 2] = HEAP32[$190 >> 2] | 1 << ($187 & 31);
   $195 = HEAP32[$151 >> 2] | 0;
   $196 = HEAP32[$153 >> 2] | 0;
   do if (($195 | 0) == ($196 << 5 | 0)) if (($195 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
    $203 = $196 << 6;
    $205 = $195 + 32 & -32;
    __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $196 << 5 >>> 0 < 1073741823 ? ($203 >>> 0 < $205 >>> 0 ? $205 : $203) : 2147483647);
    $208 = HEAP32[$151 >> 2] | 0;
    break;
   } else $208 = $195; while (0);
   HEAP32[$151 >> 2] = $208 + 1;
   $211 = (HEAP32[$0 >> 2] | 0) + ($208 >>> 5 << 2) | 0;
   HEAP32[$211 >> 2] = HEAP32[$211 >> 2] | 1 << ($208 & 31);
   $216 = HEAP32[$151 >> 2] | 0;
   $217 = HEAP32[$153 >> 2] | 0;
   do if (($216 | 0) == ($217 << 5 | 0)) if (($216 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
    $224 = $217 << 6;
    $226 = $216 + 32 & -32;
    __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $217 << 5 >>> 0 < 1073741823 ? ($224 >>> 0 < $226 >>> 0 ? $226 : $224) : 2147483647);
    $229 = HEAP32[$151 >> 2] | 0;
    break;
   } else $229 = $216; while (0);
   HEAP32[$151 >> 2] = $229 + 1;
   $230 = HEAP32[$0 >> 2] | 0;
   $232 = $230 + ($229 >>> 5 << 2) | 0;
   HEAP32[$232 >> 2] = HEAP32[$232 >> 2] & ~(1 << ($229 & 31));
   $$0 = $7 + 65368 | 0;
   $$046 = 9;
   $$pre$phi161Z2D = $153;
   $$pre$phi162Z2D = $0;
   $$pre$phiZ2D = $151;
   $358 = $230;
   break;
  }
  if ($$0$i << 16 >> 16 >= 2727) {
   $327 = ___cxa_allocate_exception(8) | 0;
   __ZNSt13runtime_errorC2EPKc($327, 12429);
   ___cxa_throw($327 | 0, 440, 8);
  }
  $240 = $0 + 4 | 0;
  $241 = HEAP32[$240 >> 2] | 0;
  $242 = $0 + 8 | 0;
  $243 = HEAP32[$242 >> 2] | 0;
  do if (($241 | 0) == ($243 << 5 | 0)) if (($241 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
   $250 = $243 << 6;
   $252 = $241 + 32 & -32;
   __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $243 << 5 >>> 0 < 1073741823 ? ($250 >>> 0 < $252 >>> 0 ? $252 : $250) : 2147483647);
   $255 = HEAP32[$240 >> 2] | 0;
   break;
  } else $255 = $241; while (0);
  HEAP32[$240 >> 2] = $255 + 1;
  $258 = (HEAP32[$0 >> 2] | 0) + ($255 >>> 5 << 2) | 0;
  HEAP32[$258 >> 2] = HEAP32[$258 >> 2] | 1 << ($255 & 31);
  $263 = HEAP32[$240 >> 2] | 0;
  $264 = HEAP32[$242 >> 2] | 0;
  do if (($263 | 0) == ($264 << 5 | 0)) if (($263 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
   $271 = $264 << 6;
   $273 = $263 + 32 & -32;
   __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $264 << 5 >>> 0 < 1073741823 ? ($271 >>> 0 < $273 >>> 0 ? $273 : $271) : 2147483647);
   $276 = HEAP32[$240 >> 2] | 0;
   break;
  } else $276 = $263; while (0);
  HEAP32[$240 >> 2] = $276 + 1;
  $279 = (HEAP32[$0 >> 2] | 0) + ($276 >>> 5 << 2) | 0;
  HEAP32[$279 >> 2] = HEAP32[$279 >> 2] | 1 << ($276 & 31);
  $284 = HEAP32[$240 >> 2] | 0;
  $285 = HEAP32[$242 >> 2] | 0;
  do if (($284 | 0) == ($285 << 5 | 0)) if (($284 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
   $292 = $285 << 6;
   $294 = $284 + 32 & -32;
   __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $285 << 5 >>> 0 < 1073741823 ? ($292 >>> 0 < $294 >>> 0 ? $294 : $292) : 2147483647);
   $297 = HEAP32[$240 >> 2] | 0;
   break;
  } else $297 = $284; while (0);
  HEAP32[$240 >> 2] = $297 + 1;
  $300 = (HEAP32[$0 >> 2] | 0) + ($297 >>> 5 << 2) | 0;
  HEAP32[$300 >> 2] = HEAP32[$300 >> 2] | 1 << ($297 & 31);
  $305 = HEAP32[$240 >> 2] | 0;
  $306 = HEAP32[$242 >> 2] | 0;
  do if (($305 | 0) == ($306 << 5 | 0)) if (($305 + 1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0); else {
   $313 = $306 << 6;
   $315 = $305 + 32 & -32;
   __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $306 << 5 >>> 0 < 1073741823 ? ($313 >>> 0 < $315 >>> 0 ? $315 : $313) : 2147483647);
   $318 = HEAP32[$240 >> 2] | 0;
   break;
  } else $318 = $305; while (0);
  HEAP32[$240 >> 2] = $318 + 1;
  $319 = HEAP32[$0 >> 2] | 0;
  $321 = $319 + ($318 >>> 5 << 2) | 0;
  HEAP32[$321 >> 2] = HEAP32[$321 >> 2] | 1 << ($318 & 31);
  $$0 = $7 + 64856 | 0;
  $$046 = 11;
  $$pre$phi161Z2D = $242;
  $$pre$phi162Z2D = $0;
  $$pre$phiZ2D = $240;
  $358 = $319;
 } while (0);
 $328 = $$0 << 16 >> 16;
 $$043160 = 0;
 $359 = $358;
 while (1) {
  $331 = (1 << $$043160 & $328 | 0) == 0;
  $332 = HEAP32[$$pre$phiZ2D >> 2] | 0;
  $333 = HEAP32[$$pre$phi161Z2D >> 2] | 0;
  if (($332 | 0) == ($333 << 5 | 0)) {
   if (($332 + 1 | 0) < 0) {
    label = 77;
    break;
   }
   $340 = $333 << 6;
   $342 = $332 + 32 & -32;
   __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $333 << 5 >>> 0 < 1073741823 ? ($340 >>> 0 < $342 >>> 0 ? $342 : $340) : 2147483647);
   $345 = HEAP32[$$pre$phiZ2D >> 2] | 0;
   $348 = HEAP32[$$pre$phi162Z2D >> 2] | 0;
  } else {
   $345 = $332;
   $348 = $359;
  }
  HEAP32[$$pre$phiZ2D >> 2] = $345 + 1;
  $347 = $348 + ($345 >>> 5 << 2) | 0;
  $350 = 1 << ($345 & 31);
  if ($331) $storemerge$i$i = HEAP32[$347 >> 2] & ~$350; else $storemerge$i$i = HEAP32[$347 >> 2] | $350;
  HEAP32[$347 >> 2] = $storemerge$i$i;
  $$043160 = $$043160 + 1 | 0;
  if (($$043160 | 0) >= ($$046 | 0)) {
   label = 74;
   break;
  } else $359 = $348;
 }
 if ((label | 0) == 74) return $$046 | 0; else if ((label | 0) == 77) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 return 0;
}

function __Z10threshold3RNSt3__26vectorIsNS_9allocatorIsEEEEi($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0$i$i$i = 0, $$0$i$i$i$i = 0, $$0$i$i$i$i69 = 0, $$048$lcssa = 0, $$048$lcssa111 = 0, $$04897 = 0, $$049100 = 0, $$051103 = 0, $$1$i$i$i$i = 0, $$1$i$i$i$i75 = 0, $$2$i$i$i$i = 0, $$2$i$i$i$i77 = 0, $$in = 0, $$lcssa91 = 0, $$sroa$020$0$in$i$i$i = 0, $$sroa$026$0$in$i$i$i = 0, $$sroa$026$0$in$i$i$i$phi = 0, $$sroa$030$0$i$i$i$i = 0, $$sroa$030$0$i$i$i$i68 = 0, $$sroa$030$1$i$i$i$i = 0, $$sroa$030$1$i$i$i$i73 = 0, $$sroa$030$2$i$i$i$i = 0, $$sroa$030$2$i$i$i$i76 = 0, $$sroa$042$0$i$i$i$i = 0, $$sroa$042$0$i$i$i$i$phi = 0, $$sroa$042$0$i$i$i$i74 = 0, $$sroa$042$0$i$i$i$i74$phi = 0, $$sroa$4$0$$sroa_idx3 = 0, $$sroa$4$0$copyload = 0, $10 = 0, $100 = 0, $102 = 0, $103 = 0, $105 = 0, $106 = 0, $108 = 0, $109 = 0, $11 = 0, $111 = 0, $113 = 0, $114 = 0, $12 = 0, $128 = 0, $130 = 0, $133 = 0, $134 = 0.0, $137 = 0, $140 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $15 = 0, $151 = 0, $16 = 0, $167 = 0, $169 = 0, $17 = 0, $170 = 0, $173 = 0, $175 = 0, $177 = 0, $179 = 0, $18 = 0, $180 = 0, $194 = 0, $196 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0.0, $203 = 0, $206 = 0, $21 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $217 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $233 = 0, $236 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $247 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $27 = 0, $28 = 0, $3 = 0, $31 = 0, $34 = 0, $4 = 0, $42 = 0, $44 = 0, $49 = 0, $5 = 0, $50 = 0, $55 = 0, $56 = 0, $57 = 0, $59 = 0, $6 = 0, $60 = 0, $64 = 0, $65 = 0, $67 = 0, $7 = 0, $72 = 0, $74 = 0, $77 = 0, $78 = 0.0, $80 = 0, $86 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, sp = 0, $167$looptemp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48 | 0;
 $2 = sp + 24 | 0;
 $3 = sp + 8 | 0;
 $4 = sp;
 $5 = HEAP32[$0 >> 2] | 0;
 $6 = HEAP16[$5 >> 1] | 0;
 $7 = $6 << 16 >> 16;
 $10 = HEAP16[$5 + 2 >> 1] | 0;
 $11 = __Z15calculateImpactj($10) | 0;
 __ZNSt3__26vectorIfNS_9allocatorIfEEEC2ERKS3_($2, $11);
 HEAP32[$3 >> 2] = 0;
 $12 = $3 + 4 | 0;
 HEAP32[$12 >> 2] = 0;
 HEAP32[$3 + 8 >> 2] = 0;
 if (!($6 << 16 >> 16)) $$048$lcssa111 = 0; else {
  $15 = Math_imul($10, $10) | 0;
  $16 = ($15 | 0) == 0;
  $17 = $4 + 4 | 0;
  $18 = $3 + 8 | 0;
  $$051103 = 0;
  $257 = 0;
  $258 = 0;
  $259 = 0;
  while (1) {
   if ($16) {
    $21 = $258;
    $23 = $257;
    $260 = $259;
   } else {
    $20 = (Math_imul($$051103, $15) | 0) + 2 | 0;
    $$049100 = 0;
    $261 = $257;
    $262 = $258;
    $42 = $259;
    while (1) {
     $31 = $20 + $$049100 | 0;
     $34 = HEAP16[(HEAP32[$0 >> 2] | 0) + ($31 << 1) >> 1] | 0;
     if (!($34 << 16 >> 16)) {
      $263 = $261;
      $264 = $262;
      $265 = $42;
     } else {
      HEAPF32[$4 >> 2] = +($34 << 16 >> 16) * +HEAPF32[(HEAP32[$2 >> 2] | 0) + ($$049100 << 2) >> 2];
      HEAP32[$17 >> 2] = $31;
      if ($42 >>> 0 < (HEAP32[$18 >> 2] | 0) >>> 0) {
       $44 = $4;
       $49 = HEAP32[$44 + 4 >> 2] | 0;
       $50 = $42;
       HEAP32[$50 >> 2] = HEAP32[$44 >> 2];
       HEAP32[$50 + 4 >> 2] = $49;
       $55 = (HEAP32[$12 >> 2] | 0) + 8 | 0;
       HEAP32[$12 >> 2] = $55;
       $$in = $55;
      } else {
       __ZNSt3__26vectorINS_4pairIfiEENS_9allocatorIS2_EEE21__push_back_slow_pathIS2_EEvOT_($3, $4);
       $$in = HEAP32[$12 >> 2] | 0;
      }
      $56 = $$in;
      $57 = HEAP32[$3 >> 2] | 0;
      $59 = $57;
      $60 = $$in - $59 | 0;
      if (($60 | 0) > 8) {
       $64 = (($60 >> 3) + -2 | 0) / 2 | 0;
       $65 = $57 + ($64 << 3) | 0;
       $67 = $$in + -8 | 0;
       if (+Math_abs(+(+HEAPF32[$65 >> 2])) < +Math_abs(+(+HEAPF32[$67 >> 2]))) {
        $72 = $67;
        $74 = HEAP32[$72 >> 2] | 0;
        $77 = HEAP32[$72 + 4 >> 2] | 0;
        $78 = (HEAP32[tempDoublePtr >> 2] = $74, +HEAPF32[tempDoublePtr >> 2]);
        $$0$i$i$i = $64;
        $$sroa$020$0$in$i$i$i = $65;
        $$sroa$026$0$in$i$i$i = $67;
        while (1) {
         HEAP32[$$sroa$026$0$in$i$i$i >> 2] = HEAP32[$$sroa$020$0$in$i$i$i >> 2];
         $80 = $$sroa$020$0$in$i$i$i + 4 | 0;
         HEAP32[$$sroa$026$0$in$i$i$i + 4 >> 2] = HEAP32[$80 >> 2];
         if (!$$0$i$i$i) break;
         $$0$i$i$i = ($$0$i$i$i + -1 | 0) / 2 | 0;
         $86 = $57 + ($$0$i$i$i << 3) | 0;
         if (!(+Math_abs(+(+HEAPF32[$86 >> 2])) < +Math_abs(+$78))) break; else {
          $$sroa$026$0$in$i$i$i$phi = $$sroa$020$0$in$i$i$i;
          $$sroa$020$0$in$i$i$i = $86;
          $$sroa$026$0$in$i$i$i = $$sroa$026$0$in$i$i$i$phi;
         }
        }
        HEAP32[$$sroa$020$0$in$i$i$i >> 2] = $74;
        HEAP32[$80 >> 2] = $77;
       }
      }
      if ($56 - $59 >> 3 >>> 0 > $1 >>> 0) {
       $94 = $57;
       $95 = $57 + 4 | 0;
       $96 = $57 + 8 | 0;
       $97 = $96;
       $98 = $57 + 16 | 0;
       $99 = $98;
       $100 = $$in;
       while (1) {
        $102 = $100 - $94 | 0;
        $103 = $102 >> 3;
        $105 = $100 + -8 | 0;
        if (($102 | 0) > 8) {
         $106 = HEAP32[$57 >> 2] | 0;
         HEAP32[$57 >> 2] = HEAP32[$105 >> 2];
         HEAP32[$105 >> 2] = $106;
         $108 = $100 + -4 | 0;
         $109 = HEAP32[$95 >> 2] | 0;
         HEAP32[$95 >> 2] = HEAP32[$108 >> 2];
         HEAP32[$108 >> 2] = $109;
         $111 = $103 + -1 | 0;
         if (($103 | 0) != 2) {
          $113 = $103 + -3 | 0;
          $114 = ($113 | 0) / 2 | 0;
          if (($113 | 0) >= -1) {
           if (($111 | 0) > 2) if (+Math_abs(+(+HEAPF32[$96 >> 2])) < +Math_abs(+(+HEAPF32[$98 >> 2]))) {
            $$0$i$i$i$i = 2;
            $$sroa$030$0$i$i$i$i = $99;
           } else {
            $$0$i$i$i$i = 1;
            $$sroa$030$0$i$i$i$i = $97;
           } else {
            $$0$i$i$i$i = 1;
            $$sroa$030$0$i$i$i$i = $97;
           }
           if (!(+Math_abs(+(+HEAPF32[$$sroa$030$0$i$i$i$i >> 2])) < +Math_abs(+(+HEAPF32[$57 >> 2])))) {
            $128 = $57;
            $130 = HEAP32[$128 >> 2] | 0;
            $133 = HEAP32[$128 + 4 >> 2] | 0;
            $134 = (HEAP32[tempDoublePtr >> 2] = $130, +HEAPF32[tempDoublePtr >> 2]);
            $$1$i$i$i$i = $$0$i$i$i$i;
            $$sroa$030$1$i$i$i$i = $$sroa$030$0$i$i$i$i;
            $$sroa$042$0$i$i$i$i = $94;
            while (1) {
             $137 = $$sroa$030$1$i$i$i$i;
             HEAP32[$$sroa$042$0$i$i$i$i >> 2] = HEAP32[$137 >> 2];
             $140 = $$sroa$030$1$i$i$i$i + 4 | 0;
             HEAP32[$$sroa$042$0$i$i$i$i + 4 >> 2] = HEAP32[$140 >> 2];
             if (($114 | 0) < ($$1$i$i$i$i | 0)) break;
             $145 = $$1$i$i$i$i << 1 | 1;
             $146 = $57 + ($145 << 3) | 0;
             $147 = $146;
             $148 = $145 + 1 | 0;
             do if (($148 | 0) < ($111 | 0)) {
              $151 = $146 + 8 | 0;
              if (!(+Math_abs(+(+HEAPF32[$146 >> 2])) < +Math_abs(+(+HEAPF32[$151 >> 2])))) {
               $$2$i$i$i$i = $145;
               $$sroa$030$2$i$i$i$i = $147;
               break;
              }
              $$2$i$i$i$i = $148;
              $$sroa$030$2$i$i$i$i = $151;
             } else {
              $$2$i$i$i$i = $145;
              $$sroa$030$2$i$i$i$i = $147;
             } while (0);
             if (+Math_abs(+(+HEAPF32[$$sroa$030$2$i$i$i$i >> 2])) < +Math_abs(+$134)) break; else {
              $$sroa$042$0$i$i$i$i$phi = $$sroa$030$1$i$i$i$i;
              $$1$i$i$i$i = $$2$i$i$i$i;
              $$sroa$030$1$i$i$i$i = $$sroa$030$2$i$i$i$i;
              $$sroa$042$0$i$i$i$i = $$sroa$042$0$i$i$i$i$phi;
             }
            }
            HEAP32[$137 >> 2] = $130;
            HEAP32[$140 >> 2] = $133;
           }
          }
         }
        }
        HEAP32[$12 >> 2] = $105;
        if ($105 - $59 >> 3 >>> 0 > $1 >>> 0) $100 = $105; else {
         $263 = $105;
         $264 = $57;
         $265 = $105;
         break;
        }
       }
      } else {
       $263 = $$in;
       $264 = $57;
       $265 = $$in;
      }
     }
     $$049100 = $$049100 + 1 | 0;
     if ($$049100 >>> 0 >= $15 >>> 0) {
      $21 = $264;
      $23 = $263;
      $260 = $265;
      break;
     } else {
      $261 = $263;
      $262 = $264;
      $42 = $265;
     }
    }
   }
   $$051103 = $$051103 + 1 | 0;
   if ($$051103 >>> 0 >= $7 >>> 0) break; else {
    $257 = $23;
    $258 = $21;
    $259 = $260;
   }
  }
  if (($21 | 0) == ($23 | 0)) {
   $$048$lcssa = 0;
   $$lcssa91 = $23;
  } else {
   $$sroa$4$0$$sroa_idx3 = $21 + 4 | 0;
   $24 = $21;
   $25 = $21 + 8 | 0;
   $26 = $25;
   $27 = $21 + 16 | 0;
   $28 = $27;
   $$04897 = 0;
   $167 = $23;
   while (1) {
    $$sroa$4$0$copyload = HEAP32[$$sroa$4$0$$sroa_idx3 >> 2] | 0;
    $169 = $167 - $24 | 0;
    $170 = $169 >> 3;
    $167$looptemp = $167;
    $167 = $167 + -8 | 0;
    if (($169 | 0) > 8) {
     $173 = HEAP32[$21 >> 2] | 0;
     HEAP32[$21 >> 2] = HEAP32[$167 >> 2];
     HEAP32[$167 >> 2] = $173;
     $175 = $167$looptemp + -4 | 0;
     HEAP32[$$sroa$4$0$$sroa_idx3 >> 2] = HEAP32[$175 >> 2];
     HEAP32[$175 >> 2] = $$sroa$4$0$copyload;
     $177 = $170 + -1 | 0;
     if (($170 | 0) != 2) {
      $179 = $170 + -3 | 0;
      $180 = ($179 | 0) / 2 | 0;
      if (($179 | 0) >= -1) {
       if (($177 | 0) > 2) if (+Math_abs(+(+HEAPF32[$25 >> 2])) < +Math_abs(+(+HEAPF32[$27 >> 2]))) {
        $$0$i$i$i$i69 = 2;
        $$sroa$030$0$i$i$i$i68 = $28;
       } else {
        $$0$i$i$i$i69 = 1;
        $$sroa$030$0$i$i$i$i68 = $26;
       } else {
        $$0$i$i$i$i69 = 1;
        $$sroa$030$0$i$i$i$i68 = $26;
       }
       if (!(+Math_abs(+(+HEAPF32[$$sroa$030$0$i$i$i$i68 >> 2])) < +Math_abs(+(+HEAPF32[$21 >> 2])))) {
        $194 = $21;
        $196 = HEAP32[$194 >> 2] | 0;
        $199 = HEAP32[$194 + 4 >> 2] | 0;
        $200 = (HEAP32[tempDoublePtr >> 2] = $196, +HEAPF32[tempDoublePtr >> 2]);
        $$1$i$i$i$i75 = $$0$i$i$i$i69;
        $$sroa$030$1$i$i$i$i73 = $$sroa$030$0$i$i$i$i68;
        $$sroa$042$0$i$i$i$i74 = $24;
        while (1) {
         $203 = $$sroa$030$1$i$i$i$i73;
         HEAP32[$$sroa$042$0$i$i$i$i74 >> 2] = HEAP32[$203 >> 2];
         $206 = $$sroa$030$1$i$i$i$i73 + 4 | 0;
         HEAP32[$$sroa$042$0$i$i$i$i74 + 4 >> 2] = HEAP32[$206 >> 2];
         if (($180 | 0) < ($$1$i$i$i$i75 | 0)) break;
         $211 = $$1$i$i$i$i75 << 1 | 1;
         $212 = $21 + ($211 << 3) | 0;
         $213 = $212;
         $214 = $211 + 1 | 0;
         if (($214 | 0) < ($177 | 0)) {
          $217 = $212 + 8 | 0;
          if (+Math_abs(+(+HEAPF32[$212 >> 2])) < +Math_abs(+(+HEAPF32[$217 >> 2]))) {
           $$2$i$i$i$i77 = $214;
           $$sroa$030$2$i$i$i$i76 = $217;
          } else {
           $$2$i$i$i$i77 = $211;
           $$sroa$030$2$i$i$i$i76 = $213;
          }
         } else {
          $$2$i$i$i$i77 = $211;
          $$sroa$030$2$i$i$i$i76 = $213;
         }
         if (+Math_abs(+(+HEAPF32[$$sroa$030$2$i$i$i$i76 >> 2])) < +Math_abs(+$200)) break; else {
          $$sroa$042$0$i$i$i$i74$phi = $$sroa$030$1$i$i$i$i73;
          $$1$i$i$i$i75 = $$2$i$i$i$i77;
          $$sroa$030$1$i$i$i$i73 = $$sroa$030$2$i$i$i$i76;
          $$sroa$042$0$i$i$i$i74 = $$sroa$042$0$i$i$i$i74$phi;
         }
        }
        HEAP32[$203 >> 2] = $196;
        HEAP32[$206 >> 2] = $199;
       }
      }
     }
    }
    HEAP32[$12 >> 2] = $167;
    $229 = (HEAP32[$0 >> 2] | 0) + ($$sroa$4$0$copyload << 1) | 0;
    $230 = HEAP16[$229 >> 1] | 0;
    $231 = $230 << 16 >> 16;
    $233 = ($230 << 16 >> 16 > -1 ? $231 : 0 - $231 | 0) + $$04897 | 0;
    HEAP16[$229 >> 1] = 0;
    if (($21 | 0) == ($167 | 0)) {
     $$048$lcssa = $233;
     $$lcssa91 = $21;
     break;
    } else $$04897 = $233;
   }
  }
  if (!$$lcssa91) $$048$lcssa111 = $$048$lcssa; else {
   __ZdlPv($$lcssa91);
   $$048$lcssa111 = $$048$lcssa;
  }
 }
 $236 = HEAP32[$2 >> 2] | 0;
 $238 = $236;
 if ($236 | 0) {
  $239 = $2 + 4 | 0;
  $240 = HEAP32[$239 >> 2] | 0;
  if (($240 | 0) != ($236 | 0)) HEAP32[$239 >> 2] = $240 + (~(($240 + -4 - $238 | 0) >>> 2) << 2);
  __ZdlPv($236);
 }
 if (!$11) {
  STACKTOP = sp;
  return $$048$lcssa111 | 0;
 }
 $247 = HEAP32[$11 >> 2] | 0;
 $249 = $247;
 if ($247 | 0) {
  $250 = $11 + 4 | 0;
  $251 = HEAP32[$250 >> 2] | 0;
  if (($251 | 0) != ($247 | 0)) HEAP32[$250 >> 2] = $251 + (~(($251 + -4 - $249 | 0) >>> 2) << 2);
  __ZdlPv($247);
 }
 __ZdlPv($11);
 STACKTOP = sp;
 return $$048$lcssa111 | 0;
}

function _free($0) {
 $0 = $0 | 0;
 var $$0211$i = 0, $$0211$in$i = 0, $$0381 = 0, $$0382 = 0, $$0394 = 0, $$0401 = 0, $$1 = 0, $$1380 = 0, $$1385 = 0, $$1388 = 0, $$1396 = 0, $$1400 = 0, $$2 = 0, $$3 = 0, $$3398 = 0, $$pre$phi439Z2D = 0, $$pre$phi441Z2D = 0, $$pre$phiZ2D = 0, $10 = 0, $105 = 0, $106 = 0, $114 = 0, $115 = 0, $123 = 0, $13 = 0, $131 = 0, $136 = 0, $137 = 0, $140 = 0, $142 = 0, $144 = 0, $159 = 0, $16 = 0, $164 = 0, $166 = 0, $169 = 0, $17 = 0, $172 = 0, $175 = 0, $178 = 0, $179 = 0, $180 = 0, $182 = 0, $184 = 0, $185 = 0, $187 = 0, $188 = 0, $194 = 0, $195 = 0, $2 = 0, $204 = 0, $209 = 0, $21 = 0, $212 = 0, $213 = 0, $219 = 0, $234 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $243 = 0, $244 = 0, $250 = 0, $255 = 0, $256 = 0, $259 = 0, $26 = 0, $261 = 0, $264 = 0, $269 = 0, $275 = 0, $279 = 0, $28 = 0, $280 = 0, $298 = 0, $3 = 0, $300 = 0, $307 = 0, $308 = 0, $309 = 0, $317 = 0, $41 = 0, $46 = 0, $48 = 0, $51 = 0, $53 = 0, $56 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $63 = 0, $65 = 0, $66 = 0, $68 = 0, $69 = 0, $7 = 0, $74 = 0, $75 = 0, $84 = 0, $89 = 0, $9 = 0, $92 = 0, $93 = 0, $99 = 0, label = 0;
 if (!$0) return;
 $2 = $0 + -8 | 0;
 $3 = HEAP32[4525] | 0;
 if ($2 >>> 0 < $3 >>> 0) _abort();
 $6 = HEAP32[$0 + -4 >> 2] | 0;
 $7 = $6 & 3;
 if (($7 | 0) == 1) _abort();
 $9 = $6 & -8;
 $10 = $2 + $9 | 0;
 do if (!($6 & 1)) {
  $13 = HEAP32[$2 >> 2] | 0;
  if (!$7) return;
  $16 = $2 + (0 - $13) | 0;
  $17 = $13 + $9 | 0;
  if ($16 >>> 0 < $3 >>> 0) _abort();
  if (($16 | 0) == (HEAP32[4526] | 0)) {
   $105 = $10 + 4 | 0;
   $106 = HEAP32[$105 >> 2] | 0;
   if (($106 & 3 | 0) != 3) {
    $$1 = $16;
    $$1380 = $17;
    break;
   }
   HEAP32[4523] = $17;
   HEAP32[$105 >> 2] = $106 & -2;
   HEAP32[$16 + 4 >> 2] = $17 | 1;
   HEAP32[$16 + $17 >> 2] = $17;
   return;
  }
  $21 = $13 >>> 3;
  if ($13 >>> 0 < 256) {
   $24 = HEAP32[$16 + 8 >> 2] | 0;
   $26 = HEAP32[$16 + 12 >> 2] | 0;
   $28 = 18124 + ($21 << 1 << 2) | 0;
   if (($24 | 0) != ($28 | 0)) {
    if ($24 >>> 0 < $3 >>> 0) _abort();
    if ((HEAP32[$24 + 12 >> 2] | 0) != ($16 | 0)) _abort();
   }
   if (($26 | 0) == ($24 | 0)) {
    HEAP32[4521] = HEAP32[4521] & ~(1 << $21);
    $$1 = $16;
    $$1380 = $17;
    break;
   }
   if (($26 | 0) == ($28 | 0)) $$pre$phi441Z2D = $26 + 8 | 0; else {
    if ($26 >>> 0 < $3 >>> 0) _abort();
    $41 = $26 + 8 | 0;
    if ((HEAP32[$41 >> 2] | 0) == ($16 | 0)) $$pre$phi441Z2D = $41; else _abort();
   }
   HEAP32[$24 + 12 >> 2] = $26;
   HEAP32[$$pre$phi441Z2D >> 2] = $24;
   $$1 = $16;
   $$1380 = $17;
   break;
  }
  $46 = HEAP32[$16 + 24 >> 2] | 0;
  $48 = HEAP32[$16 + 12 >> 2] | 0;
  do if (($48 | 0) == ($16 | 0)) {
   $59 = $16 + 16 | 0;
   $60 = $59 + 4 | 0;
   $61 = HEAP32[$60 >> 2] | 0;
   if (!$61) {
    $63 = HEAP32[$59 >> 2] | 0;
    if (!$63) {
     $$3 = 0;
     break;
    } else {
     $$1385 = $63;
     $$1388 = $59;
    }
   } else {
    $$1385 = $61;
    $$1388 = $60;
   }
   while (1) {
    $65 = $$1385 + 20 | 0;
    $66 = HEAP32[$65 >> 2] | 0;
    if ($66 | 0) {
     $$1385 = $66;
     $$1388 = $65;
     continue;
    }
    $68 = $$1385 + 16 | 0;
    $69 = HEAP32[$68 >> 2] | 0;
    if (!$69) break; else {
     $$1385 = $69;
     $$1388 = $68;
    }
   }
   if ($$1388 >>> 0 < $3 >>> 0) _abort(); else {
    HEAP32[$$1388 >> 2] = 0;
    $$3 = $$1385;
    break;
   }
  } else {
   $51 = HEAP32[$16 + 8 >> 2] | 0;
   if ($51 >>> 0 < $3 >>> 0) _abort();
   $53 = $51 + 12 | 0;
   if ((HEAP32[$53 >> 2] | 0) != ($16 | 0)) _abort();
   $56 = $48 + 8 | 0;
   if ((HEAP32[$56 >> 2] | 0) == ($16 | 0)) {
    HEAP32[$53 >> 2] = $48;
    HEAP32[$56 >> 2] = $51;
    $$3 = $48;
    break;
   } else _abort();
  } while (0);
  if (!$46) {
   $$1 = $16;
   $$1380 = $17;
  } else {
   $74 = HEAP32[$16 + 28 >> 2] | 0;
   $75 = 18388 + ($74 << 2) | 0;
   if (($16 | 0) == (HEAP32[$75 >> 2] | 0)) {
    HEAP32[$75 >> 2] = $$3;
    if (!$$3) {
     HEAP32[4522] = HEAP32[4522] & ~(1 << $74);
     $$1 = $16;
     $$1380 = $17;
     break;
    }
   } else {
    if ($46 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort();
    $84 = $46 + 16 | 0;
    if ((HEAP32[$84 >> 2] | 0) == ($16 | 0)) HEAP32[$84 >> 2] = $$3; else HEAP32[$46 + 20 >> 2] = $$3;
    if (!$$3) {
     $$1 = $16;
     $$1380 = $17;
     break;
    }
   }
   $89 = HEAP32[4525] | 0;
   if ($$3 >>> 0 < $89 >>> 0) _abort();
   HEAP32[$$3 + 24 >> 2] = $46;
   $92 = $16 + 16 | 0;
   $93 = HEAP32[$92 >> 2] | 0;
   do if ($93 | 0) if ($93 >>> 0 < $89 >>> 0) _abort(); else {
    HEAP32[$$3 + 16 >> 2] = $93;
    HEAP32[$93 + 24 >> 2] = $$3;
    break;
   } while (0);
   $99 = HEAP32[$92 + 4 >> 2] | 0;
   if (!$99) {
    $$1 = $16;
    $$1380 = $17;
   } else if ($99 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
    HEAP32[$$3 + 20 >> 2] = $99;
    HEAP32[$99 + 24 >> 2] = $$3;
    $$1 = $16;
    $$1380 = $17;
    break;
   }
  }
 } else {
  $$1 = $2;
  $$1380 = $9;
 } while (0);
 if ($$1 >>> 0 >= $10 >>> 0) _abort();
 $114 = $10 + 4 | 0;
 $115 = HEAP32[$114 >> 2] | 0;
 if (!($115 & 1)) _abort();
 if (!($115 & 2)) {
  if (($10 | 0) == (HEAP32[4527] | 0)) {
   $123 = (HEAP32[4524] | 0) + $$1380 | 0;
   HEAP32[4524] = $123;
   HEAP32[4527] = $$1;
   HEAP32[$$1 + 4 >> 2] = $123 | 1;
   if (($$1 | 0) != (HEAP32[4526] | 0)) return;
   HEAP32[4526] = 0;
   HEAP32[4523] = 0;
   return;
  }
  if (($10 | 0) == (HEAP32[4526] | 0)) {
   $131 = (HEAP32[4523] | 0) + $$1380 | 0;
   HEAP32[4523] = $131;
   HEAP32[4526] = $$1;
   HEAP32[$$1 + 4 >> 2] = $131 | 1;
   HEAP32[$$1 + $131 >> 2] = $131;
   return;
  }
  $136 = ($115 & -8) + $$1380 | 0;
  $137 = $115 >>> 3;
  do if ($115 >>> 0 < 256) {
   $140 = HEAP32[$10 + 8 >> 2] | 0;
   $142 = HEAP32[$10 + 12 >> 2] | 0;
   $144 = 18124 + ($137 << 1 << 2) | 0;
   if (($140 | 0) != ($144 | 0)) {
    if ($140 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort();
    if ((HEAP32[$140 + 12 >> 2] | 0) != ($10 | 0)) _abort();
   }
   if (($142 | 0) == ($140 | 0)) {
    HEAP32[4521] = HEAP32[4521] & ~(1 << $137);
    break;
   }
   if (($142 | 0) == ($144 | 0)) $$pre$phi439Z2D = $142 + 8 | 0; else {
    if ($142 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort();
    $159 = $142 + 8 | 0;
    if ((HEAP32[$159 >> 2] | 0) == ($10 | 0)) $$pre$phi439Z2D = $159; else _abort();
   }
   HEAP32[$140 + 12 >> 2] = $142;
   HEAP32[$$pre$phi439Z2D >> 2] = $140;
  } else {
   $164 = HEAP32[$10 + 24 >> 2] | 0;
   $166 = HEAP32[$10 + 12 >> 2] | 0;
   do if (($166 | 0) == ($10 | 0)) {
    $178 = $10 + 16 | 0;
    $179 = $178 + 4 | 0;
    $180 = HEAP32[$179 >> 2] | 0;
    if (!$180) {
     $182 = HEAP32[$178 >> 2] | 0;
     if (!$182) {
      $$3398 = 0;
      break;
     } else {
      $$1396 = $182;
      $$1400 = $178;
     }
    } else {
     $$1396 = $180;
     $$1400 = $179;
    }
    while (1) {
     $184 = $$1396 + 20 | 0;
     $185 = HEAP32[$184 >> 2] | 0;
     if ($185 | 0) {
      $$1396 = $185;
      $$1400 = $184;
      continue;
     }
     $187 = $$1396 + 16 | 0;
     $188 = HEAP32[$187 >> 2] | 0;
     if (!$188) break; else {
      $$1396 = $188;
      $$1400 = $187;
     }
    }
    if ($$1400 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
     HEAP32[$$1400 >> 2] = 0;
     $$3398 = $$1396;
     break;
    }
   } else {
    $169 = HEAP32[$10 + 8 >> 2] | 0;
    if ($169 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort();
    $172 = $169 + 12 | 0;
    if ((HEAP32[$172 >> 2] | 0) != ($10 | 0)) _abort();
    $175 = $166 + 8 | 0;
    if ((HEAP32[$175 >> 2] | 0) == ($10 | 0)) {
     HEAP32[$172 >> 2] = $166;
     HEAP32[$175 >> 2] = $169;
     $$3398 = $166;
     break;
    } else _abort();
   } while (0);
   if ($164 | 0) {
    $194 = HEAP32[$10 + 28 >> 2] | 0;
    $195 = 18388 + ($194 << 2) | 0;
    if (($10 | 0) == (HEAP32[$195 >> 2] | 0)) {
     HEAP32[$195 >> 2] = $$3398;
     if (!$$3398) {
      HEAP32[4522] = HEAP32[4522] & ~(1 << $194);
      break;
     }
    } else {
     if ($164 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort();
     $204 = $164 + 16 | 0;
     if ((HEAP32[$204 >> 2] | 0) == ($10 | 0)) HEAP32[$204 >> 2] = $$3398; else HEAP32[$164 + 20 >> 2] = $$3398;
     if (!$$3398) break;
    }
    $209 = HEAP32[4525] | 0;
    if ($$3398 >>> 0 < $209 >>> 0) _abort();
    HEAP32[$$3398 + 24 >> 2] = $164;
    $212 = $10 + 16 | 0;
    $213 = HEAP32[$212 >> 2] | 0;
    do if ($213 | 0) if ($213 >>> 0 < $209 >>> 0) _abort(); else {
     HEAP32[$$3398 + 16 >> 2] = $213;
     HEAP32[$213 + 24 >> 2] = $$3398;
     break;
    } while (0);
    $219 = HEAP32[$212 + 4 >> 2] | 0;
    if ($219 | 0) if ($219 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
     HEAP32[$$3398 + 20 >> 2] = $219;
     HEAP32[$219 + 24 >> 2] = $$3398;
     break;
    }
   }
  } while (0);
  HEAP32[$$1 + 4 >> 2] = $136 | 1;
  HEAP32[$$1 + $136 >> 2] = $136;
  if (($$1 | 0) == (HEAP32[4526] | 0)) {
   HEAP32[4523] = $136;
   return;
  } else $$2 = $136;
 } else {
  HEAP32[$114 >> 2] = $115 & -2;
  HEAP32[$$1 + 4 >> 2] = $$1380 | 1;
  HEAP32[$$1 + $$1380 >> 2] = $$1380;
  $$2 = $$1380;
 }
 $234 = $$2 >>> 3;
 if ($$2 >>> 0 < 256) {
  $237 = 18124 + ($234 << 1 << 2) | 0;
  $238 = HEAP32[4521] | 0;
  $239 = 1 << $234;
  if (!($238 & $239)) {
   HEAP32[4521] = $238 | $239;
   $$0401 = $237;
   $$pre$phiZ2D = $237 + 8 | 0;
  } else {
   $243 = $237 + 8 | 0;
   $244 = HEAP32[$243 >> 2] | 0;
   if ($244 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
    $$0401 = $244;
    $$pre$phiZ2D = $243;
   }
  }
  HEAP32[$$pre$phiZ2D >> 2] = $$1;
  HEAP32[$$0401 + 12 >> 2] = $$1;
  HEAP32[$$1 + 8 >> 2] = $$0401;
  HEAP32[$$1 + 12 >> 2] = $237;
  return;
 }
 $250 = $$2 >>> 8;
 if (!$250) $$0394 = 0; else if ($$2 >>> 0 > 16777215) $$0394 = 31; else {
  $255 = ($250 + 1048320 | 0) >>> 16 & 8;
  $256 = $250 << $255;
  $259 = ($256 + 520192 | 0) >>> 16 & 4;
  $261 = $256 << $259;
  $264 = ($261 + 245760 | 0) >>> 16 & 2;
  $269 = 14 - ($259 | $255 | $264) + ($261 << $264 >>> 15) | 0;
  $$0394 = $$2 >>> ($269 + 7 | 0) & 1 | $269 << 1;
 }
 $275 = 18388 + ($$0394 << 2) | 0;
 HEAP32[$$1 + 28 >> 2] = $$0394;
 HEAP32[$$1 + 20 >> 2] = 0;
 HEAP32[$$1 + 16 >> 2] = 0;
 $279 = HEAP32[4522] | 0;
 $280 = 1 << $$0394;
 do if (!($279 & $280)) {
  HEAP32[4522] = $279 | $280;
  HEAP32[$275 >> 2] = $$1;
  HEAP32[$$1 + 24 >> 2] = $275;
  HEAP32[$$1 + 12 >> 2] = $$1;
  HEAP32[$$1 + 8 >> 2] = $$1;
 } else {
  $$0381 = $$2 << (($$0394 | 0) == 31 ? 0 : 25 - ($$0394 >>> 1) | 0);
  $$0382 = HEAP32[$275 >> 2] | 0;
  while (1) {
   if ((HEAP32[$$0382 + 4 >> 2] & -8 | 0) == ($$2 | 0)) {
    label = 130;
    break;
   }
   $298 = $$0382 + 16 + ($$0381 >>> 31 << 2) | 0;
   $300 = HEAP32[$298 >> 2] | 0;
   if (!$300) {
    label = 127;
    break;
   } else {
    $$0381 = $$0381 << 1;
    $$0382 = $300;
   }
  }
  if ((label | 0) == 127) if ($298 >>> 0 < (HEAP32[4525] | 0) >>> 0) _abort(); else {
   HEAP32[$298 >> 2] = $$1;
   HEAP32[$$1 + 24 >> 2] = $$0382;
   HEAP32[$$1 + 12 >> 2] = $$1;
   HEAP32[$$1 + 8 >> 2] = $$1;
   break;
  } else if ((label | 0) == 130) {
   $307 = $$0382 + 8 | 0;
   $308 = HEAP32[$307 >> 2] | 0;
   $309 = HEAP32[4525] | 0;
   if ($308 >>> 0 >= $309 >>> 0 & $$0382 >>> 0 >= $309 >>> 0) {
    HEAP32[$308 + 12 >> 2] = $$1;
    HEAP32[$307 >> 2] = $$1;
    HEAP32[$$1 + 8 >> 2] = $308;
    HEAP32[$$1 + 12 >> 2] = $$0382;
    HEAP32[$$1 + 24 >> 2] = 0;
    break;
   } else _abort();
  }
 } while (0);
 $317 = (HEAP32[4529] | 0) + -1 | 0;
 HEAP32[4529] = $317;
 if (!$317) $$0211$in$i = 18540; else return;
 while (1) {
  $$0211$i = HEAP32[$$0211$in$i >> 2] | 0;
  if (!$$0211$i) break; else $$0211$in$i = $$0211$i + 8 | 0;
 }
 HEAP32[4529] = -1;
 return;
}

function _deflate_slow($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$$i = 0, $$$i173 = 0, $$$i175 = 0, $$$i177 = 0, $$2 = 0, $10 = 0, $100 = 0, $103 = 0, $108 = 0, $11 = 0, $111 = 0, $113 = 0, $114 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $13 = 0, $131 = 0, $133 = 0, $14 = 0, $141 = 0, $144 = 0, $145 = 0, $15 = 0, $150 = 0, $152 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $16 = 0, $161 = 0, $163 = 0, $169 = 0, $17 = 0, $175 = 0, $18 = 0, $189 = 0, $19 = 0, $190 = 0, $197 = 0, $2 = 0, $20 = 0, $204 = 0, $21 = 0, $210 = 0, $212 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $22 = 0, $221 = 0, $223 = 0, $229 = 0, $23 = 0, $235 = 0, $24 = 0, $25 = 0, $250 = 0, $257 = 0, $258 = 0, $265 = 0, $268 = 0, $27 = 0, $272 = 0, $277 = 0, $279 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $288 = 0, $290 = 0, $296 = 0, $3 = 0, $302 = 0, $312 = 0, $317 = 0, $319 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $328 = 0, $330 = 0, $336 = 0, $342 = 0, $350 = 0, $36 = 0, $4 = 0, $44 = 0, $46 = 0, $47 = 0, $5 = 0, $52 = 0, $54 = 0, $6 = 0, $64 = 0, $7 = 0, $73 = 0, $75 = 0, $77 = 0, $8 = 0, $80 = 0, $81 = 0, $85 = 0, $87 = 0, $9 = 0, label = 0;
 $2 = $0 + 116 | 0;
 $3 = ($1 | 0) == 0;
 $4 = $0 + 72 | 0;
 $5 = $0 + 88 | 0;
 $6 = $0 + 108 | 0;
 $7 = $0 + 56 | 0;
 $8 = $0 + 84 | 0;
 $9 = $0 + 68 | 0;
 $10 = $0 + 52 | 0;
 $11 = $0 + 64 | 0;
 $12 = $0 + 96 | 0;
 $13 = $0 + 120 | 0;
 $14 = $0 + 112 | 0;
 $15 = $0 + 100 | 0;
 $16 = $0 + 5792 | 0;
 $17 = $0 + 5796 | 0;
 $18 = $0 + 5784 | 0;
 $19 = $0 + 5788 | 0;
 $20 = $0 + 104 | 0;
 $21 = $0 + 92 | 0;
 $22 = $0 + 128 | 0;
 $23 = $0 + 44 | 0;
 $24 = $0 + 136 | 0;
 L1 : while (1) {
  $25 = HEAP32[$2 >> 2] | 0;
  while (1) {
   if ($25 >>> 0 < 262) {
    _fill_window($0);
    $27 = HEAP32[$2 >> 2] | 0;
    if ($3 & $27 >>> 0 < 262) {
     $$2 = 0;
     label = 55;
     break L1;
    }
    if (!$27) {
     label = 38;
     break L1;
    }
    if ($27 >>> 0 > 2) label = 8; else {
     HEAP32[$13 >> 2] = HEAP32[$12 >> 2];
     HEAP32[$15 >> 2] = HEAP32[$14 >> 2];
     HEAP32[$12 >> 2] = 2;
     $350 = 2;
     label = 16;
    }
   } else label = 8;
   do if ((label | 0) == 8) {
    label = 0;
    $36 = HEAP32[$6 >> 2] | 0;
    $44 = ((HEAPU8[(HEAP32[$7 >> 2] | 0) + ($36 + 2) >> 0] | 0) ^ HEAP32[$4 >> 2] << HEAP32[$5 >> 2]) & HEAP32[$8 >> 2];
    HEAP32[$4 >> 2] = $44;
    $46 = (HEAP32[$9 >> 2] | 0) + ($44 << 1) | 0;
    $47 = HEAP16[$46 >> 1] | 0;
    HEAP16[(HEAP32[$11 >> 2] | 0) + ((HEAP32[$10 >> 2] & $36) << 1) >> 1] = $47;
    $52 = $47 & 65535;
    HEAP16[$46 >> 1] = $36;
    $54 = HEAP32[$12 >> 2] | 0;
    HEAP32[$13 >> 2] = $54;
    HEAP32[$15 >> 2] = HEAP32[$14 >> 2];
    HEAP32[$12 >> 2] = 2;
    if (!($47 << 16 >> 16)) {
     $350 = 2;
     label = 16;
    } else if ($54 >>> 0 < (HEAP32[$22 >> 2] | 0) >>> 0) if (((HEAP32[$6 >> 2] | 0) - $52 | 0) >>> 0 > ((HEAP32[$23 >> 2] | 0) + -262 | 0) >>> 0) {
     $350 = 2;
     label = 16;
    } else {
     $64 = _longest_match($0, $52) | 0;
     HEAP32[$12 >> 2] = $64;
     if ($64 >>> 0 < 6) {
      if ((HEAP32[$24 >> 2] | 0) != 1) {
       if (($64 | 0) != 3) {
        $350 = $64;
        label = 16;
        break;
       }
       if (((HEAP32[$6 >> 2] | 0) - (HEAP32[$14 >> 2] | 0) | 0) >>> 0 <= 4096) {
        $350 = 3;
        label = 16;
        break;
       }
      }
      HEAP32[$12 >> 2] = 2;
      $350 = 2;
      label = 16;
     } else {
      $350 = $64;
      label = 16;
     }
    } else {
     $73 = $54;
     $75 = 2;
    }
   } while (0);
   if ((label | 0) == 16) {
    label = 0;
    $73 = HEAP32[$13 >> 2] | 0;
    $75 = $350;
   }
   if (!($73 >>> 0 < 3 | $75 >>> 0 > $73 >>> 0)) break;
   if (!(HEAP32[$20 >> 2] | 0)) {
    HEAP32[$20 >> 2] = 1;
    HEAP32[$6 >> 2] = (HEAP32[$6 >> 2] | 0) + 1;
    $250 = (HEAP32[$2 >> 2] | 0) + -1 | 0;
    HEAP32[$2 >> 2] = $250;
    $25 = $250;
    continue;
   }
   $189 = HEAP8[(HEAP32[$7 >> 2] | 0) + ((HEAP32[$6 >> 2] | 0) + -1) >> 0] | 0;
   $190 = HEAP32[$16 >> 2] | 0;
   HEAP16[(HEAP32[$17 >> 2] | 0) + ($190 << 1) >> 1] = 0;
   HEAP32[$16 >> 2] = $190 + 1;
   HEAP8[(HEAP32[$18 >> 2] | 0) + $190 >> 0] = $189;
   $197 = $0 + 148 + (($189 & 255) << 2) | 0;
   HEAP16[$197 >> 1] = (HEAP16[$197 >> 1] | 0) + 1 << 16 >> 16;
   if ((HEAP32[$16 >> 2] | 0) == ((HEAP32[$19 >> 2] | 0) + -1 | 0)) {
    $204 = HEAP32[$21 >> 2] | 0;
    if (($204 | 0) > -1) $210 = (HEAP32[$7 >> 2] | 0) + $204 | 0; else $210 = 0;
    __tr_flush_block($0, $210, (HEAP32[$6 >> 2] | 0) - $204 | 0, 0);
    HEAP32[$21 >> 2] = HEAP32[$6 >> 2];
    $212 = HEAP32[$0 >> 2] | 0;
    $214 = HEAP32[$212 + 28 >> 2] | 0;
    __tr_flush_bits($214);
    $215 = $214 + 20 | 0;
    $216 = HEAP32[$215 >> 2] | 0;
    $217 = $212 + 16 | 0;
    $218 = HEAP32[$217 >> 2] | 0;
    $$$i173 = $216 >>> 0 > $218 >>> 0 ? $218 : $216;
    if ($$$i173 | 0) {
     $221 = $212 + 12 | 0;
     $223 = $214 + 16 | 0;
     _memcpy(HEAP32[$221 >> 2] | 0, HEAP32[$223 >> 2] | 0, $$$i173 | 0) | 0;
     HEAP32[$221 >> 2] = (HEAP32[$221 >> 2] | 0) + $$$i173;
     HEAP32[$223 >> 2] = (HEAP32[$223 >> 2] | 0) + $$$i173;
     $229 = $212 + 20 | 0;
     HEAP32[$229 >> 2] = (HEAP32[$229 >> 2] | 0) + $$$i173;
     HEAP32[$217 >> 2] = (HEAP32[$217 >> 2] | 0) - $$$i173;
     $235 = (HEAP32[$215 >> 2] | 0) - $$$i173 | 0;
     HEAP32[$215 >> 2] = $235;
     if (!$235) HEAP32[$223 >> 2] = HEAP32[$214 + 8 >> 2];
    }
   }
   HEAP32[$6 >> 2] = (HEAP32[$6 >> 2] | 0) + 1;
   $25 = (HEAP32[$2 >> 2] | 0) + -1 | 0;
   HEAP32[$2 >> 2] = $25;
   if (!(HEAP32[(HEAP32[$0 >> 2] | 0) + 16 >> 2] | 0)) {
    $$2 = 0;
    label = 55;
    break L1;
   }
  }
  $77 = HEAP32[$6 >> 2] | 0;
  $80 = $77 + -3 + (HEAP32[$2 >> 2] | 0) | 0;
  $81 = $73 + 253 | 0;
  $85 = $77 + 65535 - (HEAP32[$15 >> 2] | 0) | 0;
  $87 = HEAP32[$16 >> 2] | 0;
  HEAP16[(HEAP32[$17 >> 2] | 0) + ($87 << 1) >> 1] = $85;
  HEAP32[$16 >> 2] = $87 + 1;
  HEAP8[(HEAP32[$18 >> 2] | 0) + $87 >> 0] = $81;
  $100 = $0 + 148 + ((HEAPU8[13012 + ($81 & 255) >> 0] | 0 | 256) + 1 << 2) | 0;
  HEAP16[$100 >> 1] = (HEAP16[$100 >> 1] | 0) + 1 << 16 >> 16;
  $103 = $85 + 65535 & 65535;
  $108 = $0 + 2440 + ((HEAPU8[12500 + ($103 >>> 0 < 256 ? $103 : ($103 >>> 7) + 256 | 0) >> 0] | 0) << 2) | 0;
  HEAP16[$108 >> 1] = (HEAP16[$108 >> 1] | 0) + 1 << 16 >> 16;
  $111 = HEAP32[$16 >> 2] | 0;
  $113 = (HEAP32[$19 >> 2] | 0) + -1 | 0;
  $114 = HEAP32[$13 >> 2] | 0;
  HEAP32[$2 >> 2] = 1 - $114 + (HEAP32[$2 >> 2] | 0);
  $117 = $114 + -2 | 0;
  HEAP32[$13 >> 2] = $117;
  $119 = HEAP32[$6 >> 2] | 0;
  $141 = $117;
  while (1) {
   $118 = $119 + 1 | 0;
   HEAP32[$6 >> 2] = $118;
   if ($118 >>> 0 <= $80 >>> 0) {
    $131 = ((HEAPU8[(HEAP32[$7 >> 2] | 0) + ($119 + 3) >> 0] | 0) ^ HEAP32[$4 >> 2] << HEAP32[$5 >> 2]) & HEAP32[$8 >> 2];
    HEAP32[$4 >> 2] = $131;
    $133 = (HEAP32[$9 >> 2] | 0) + ($131 << 1) | 0;
    HEAP16[(HEAP32[$11 >> 2] | 0) + ((HEAP32[$10 >> 2] & $118) << 1) >> 1] = HEAP16[$133 >> 1] | 0;
    HEAP16[$133 >> 1] = $118;
   }
   $141 = $141 + -1 | 0;
   HEAP32[$13 >> 2] = $141;
   if (!$141) break; else $119 = $118;
  }
  HEAP32[$20 >> 2] = 0;
  HEAP32[$12 >> 2] = 2;
  $144 = $119 + 2 | 0;
  HEAP32[$6 >> 2] = $144;
  if (($111 | 0) != ($113 | 0)) continue;
  $145 = HEAP32[$21 >> 2] | 0;
  if (($145 | 0) > -1) $150 = (HEAP32[$7 >> 2] | 0) + $145 | 0; else $150 = 0;
  __tr_flush_block($0, $150, $144 - $145 | 0, 0);
  HEAP32[$21 >> 2] = HEAP32[$6 >> 2];
  $152 = HEAP32[$0 >> 2] | 0;
  $154 = HEAP32[$152 + 28 >> 2] | 0;
  __tr_flush_bits($154);
  $155 = $154 + 20 | 0;
  $156 = HEAP32[$155 >> 2] | 0;
  $157 = $152 + 16 | 0;
  $158 = HEAP32[$157 >> 2] | 0;
  $$$i = $156 >>> 0 > $158 >>> 0 ? $158 : $156;
  if ($$$i | 0) {
   $161 = $152 + 12 | 0;
   $163 = $154 + 16 | 0;
   _memcpy(HEAP32[$161 >> 2] | 0, HEAP32[$163 >> 2] | 0, $$$i | 0) | 0;
   HEAP32[$161 >> 2] = (HEAP32[$161 >> 2] | 0) + $$$i;
   HEAP32[$163 >> 2] = (HEAP32[$163 >> 2] | 0) + $$$i;
   $169 = $152 + 20 | 0;
   HEAP32[$169 >> 2] = (HEAP32[$169 >> 2] | 0) + $$$i;
   HEAP32[$157 >> 2] = (HEAP32[$157 >> 2] | 0) - $$$i;
   $175 = (HEAP32[$155 >> 2] | 0) - $$$i | 0;
   HEAP32[$155 >> 2] = $175;
   if (!$175) HEAP32[$163 >> 2] = HEAP32[$154 + 8 >> 2];
  }
  if (!(HEAP32[(HEAP32[$0 >> 2] | 0) + 16 >> 2] | 0)) {
   $$2 = 0;
   label = 55;
   break;
  }
 }
 if ((label | 0) == 38) {
  if (HEAP32[$20 >> 2] | 0) {
   $257 = HEAP8[(HEAP32[$7 >> 2] | 0) + ((HEAP32[$6 >> 2] | 0) + -1) >> 0] | 0;
   $258 = HEAP32[$16 >> 2] | 0;
   HEAP16[(HEAP32[$17 >> 2] | 0) + ($258 << 1) >> 1] = 0;
   HEAP32[$16 >> 2] = $258 + 1;
   HEAP8[(HEAP32[$18 >> 2] | 0) + $258 >> 0] = $257;
   $265 = $0 + 148 + (($257 & 255) << 2) | 0;
   HEAP16[$265 >> 1] = (HEAP16[$265 >> 1] | 0) + 1 << 16 >> 16;
   HEAP32[$20 >> 2] = 0;
  }
  $268 = HEAP32[$6 >> 2] | 0;
  HEAP32[$0 + 5812 >> 2] = $268 >>> 0 < 2 ? $268 : 2;
  if (($1 | 0) == 4) {
   $272 = HEAP32[$21 >> 2] | 0;
   if (($272 | 0) > -1) $277 = (HEAP32[$7 >> 2] | 0) + $272 | 0; else $277 = 0;
   __tr_flush_block($0, $277, $268 - $272 | 0, 1);
   HEAP32[$21 >> 2] = HEAP32[$6 >> 2];
   $279 = HEAP32[$0 >> 2] | 0;
   $281 = HEAP32[$279 + 28 >> 2] | 0;
   __tr_flush_bits($281);
   $282 = $281 + 20 | 0;
   $283 = HEAP32[$282 >> 2] | 0;
   $284 = $279 + 16 | 0;
   $285 = HEAP32[$284 >> 2] | 0;
   $$$i175 = $283 >>> 0 > $285 >>> 0 ? $285 : $283;
   if ($$$i175 | 0) {
    $288 = $279 + 12 | 0;
    $290 = $281 + 16 | 0;
    _memcpy(HEAP32[$288 >> 2] | 0, HEAP32[$290 >> 2] | 0, $$$i175 | 0) | 0;
    HEAP32[$288 >> 2] = (HEAP32[$288 >> 2] | 0) + $$$i175;
    HEAP32[$290 >> 2] = (HEAP32[$290 >> 2] | 0) + $$$i175;
    $296 = $279 + 20 | 0;
    HEAP32[$296 >> 2] = (HEAP32[$296 >> 2] | 0) + $$$i175;
    HEAP32[$284 >> 2] = (HEAP32[$284 >> 2] | 0) - $$$i175;
    $302 = (HEAP32[$282 >> 2] | 0) - $$$i175 | 0;
    HEAP32[$282 >> 2] = $302;
    if (!$302) HEAP32[$290 >> 2] = HEAP32[$281 + 8 >> 2];
   }
   $$2 = (HEAP32[(HEAP32[$0 >> 2] | 0) + 16 >> 2] | 0) == 0 ? 2 : 3;
   return $$2 | 0;
  }
  if (HEAP32[$16 >> 2] | 0) {
   $312 = HEAP32[$21 >> 2] | 0;
   if (($312 | 0) > -1) $317 = (HEAP32[$7 >> 2] | 0) + $312 | 0; else $317 = 0;
   __tr_flush_block($0, $317, $268 - $312 | 0, 0);
   HEAP32[$21 >> 2] = HEAP32[$6 >> 2];
   $319 = HEAP32[$0 >> 2] | 0;
   $321 = HEAP32[$319 + 28 >> 2] | 0;
   __tr_flush_bits($321);
   $322 = $321 + 20 | 0;
   $323 = HEAP32[$322 >> 2] | 0;
   $324 = $319 + 16 | 0;
   $325 = HEAP32[$324 >> 2] | 0;
   $$$i177 = $323 >>> 0 > $325 >>> 0 ? $325 : $323;
   if ($$$i177 | 0) {
    $328 = $319 + 12 | 0;
    $330 = $321 + 16 | 0;
    _memcpy(HEAP32[$328 >> 2] | 0, HEAP32[$330 >> 2] | 0, $$$i177 | 0) | 0;
    HEAP32[$328 >> 2] = (HEAP32[$328 >> 2] | 0) + $$$i177;
    HEAP32[$330 >> 2] = (HEAP32[$330 >> 2] | 0) + $$$i177;
    $336 = $319 + 20 | 0;
    HEAP32[$336 >> 2] = (HEAP32[$336 >> 2] | 0) + $$$i177;
    HEAP32[$324 >> 2] = (HEAP32[$324 >> 2] | 0) - $$$i177;
    $342 = (HEAP32[$322 >> 2] | 0) - $$$i177 | 0;
    HEAP32[$322 >> 2] = $342;
    if (!$342) HEAP32[$330 >> 2] = HEAP32[$321 + 8 >> 2];
   }
   if (!(HEAP32[(HEAP32[$0 >> 2] | 0) + 16 >> 2] | 0)) {
    $$2 = 0;
    return $$2 | 0;
   }
  }
  $$2 = 1;
  return $$2 | 0;
 } else if ((label | 0) == 55) return $$2 | 0;
 return 0;
}

function _deflate_stored($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$ = 0, $$$0211 = 0, $$$i = 0, $$$i223 = 0, $$$i227 = 0, $$0211 = 0, $$0217 = 0, $$0249 = 0, $$1 = 0, $$1215 = 0, $$1215$ = 0, $$2 = 0, $$218 = 0, $$220 = 0, $$2216 = 0, $$245 = 0, $$pre230 = 0, $$pre233 = 0, $$pre237 = 0, $10 = 0, $101 = 0, $102 = 0, $105 = 0, $108 = 0, $11 = 0, $115 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $128 = 0, $13 = 0, $131 = 0, $136 = 0, $14 = 0, $140 = 0, $142 = 0, $143 = 0, $146 = 0, $15 = 0, $156 = 0, $158 = 0, $16 = 0, $160 = 0, $167 = 0, $17 = 0, $170 = 0, $173 = 0, $174 = 0, $176 = 0, $177 = 0, $18 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $196 = 0, $199 = 0, $2 = 0, $201 = 0, $211 = 0, $212 = 0, $214 = 0, $216 = 0, $217 = 0, $22 = 0, $220 = 0, $221 = 0, $223 = 0, $224 = 0, $230 = 0, $233 = 0, $236 = 0, $24 = 0, $243 = 0, $246 = 0, $251 = 0, $255 = 0, $258 = 0, $26 = 0, $263 = 0, $265 = 0, $268 = 0, $269 = 0, $27 = 0, $278 = 0, $28 = 0, $284 = 0, $285 = 0, $290 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $299 = 0, $301 = 0, $307 = 0, $31 = 0, $313 = 0, $33 = 0, $35 = 0, $4 = 0, $42 = 0, $5 = 0, $54 = 0, $6 = 0, $66 = 0, $68 = 0, $69 = 0, $70 = 0, $71 = 0, $72 = 0, $75 = 0, $77 = 0, $8 = 0, $83 = 0, $89 = 0, label = 0;
 $2 = $0 + 12 | 0;
 $4 = (HEAP32[$2 >> 2] | 0) + -5 | 0;
 $5 = $0 + 44 | 0;
 $6 = HEAP32[$5 >> 2] | 0;
 $$ = $4 >>> 0 > $6 >>> 0 ? $6 : $4;
 $8 = HEAP32[$0 >> 2] | 0;
 $10 = HEAP32[$8 + 4 >> 2] | 0;
 $11 = $0 + 5820 | 0;
 $12 = $0 + 108 | 0;
 $13 = $0 + 92 | 0;
 $14 = ($1 | 0) != 4;
 $15 = ($1 | 0) == 0;
 $16 = ($1 | 0) == 4;
 $17 = $0 + 20 | 0;
 $18 = $0 + 8 | 0;
 $19 = $0 + 56 | 0;
 $22 = (HEAP32[$11 >> 2] | 0) + 42 >> 3;
 $24 = HEAP32[$8 + 16 >> 2] | 0;
 L1 : do if ($24 >>> 0 < $22 >>> 0) {
  $$1 = 0;
  $156 = $8;
 } else {
  $$0249 = 0;
  $27 = $22;
  $28 = $24;
  $33 = $8;
  while (1) {
   $26 = $28 - $27 | 0;
   $31 = (HEAP32[$12 >> 2] | 0) - (HEAP32[$13 >> 2] | 0) | 0;
   $35 = $31 + (HEAP32[$33 + 4 >> 2] | 0) | 0;
   $$218 = $35 >>> 0 < 65535 ? $35 : 65535;
   $$1215 = $$218 >>> 0 > $26 >>> 0 ? $26 : $$218;
   if ($$1215 >>> 0 < $$ >>> 0) if (!(($$1215 | 0) == ($35 | 0) & (($15 | $14 & ($$1215 | 0) == 0) ^ 1))) {
    $$1 = $$0249;
    $156 = $33;
    break L1;
   }
   $$245 = $16 & ($$1215 | 0) == ($35 | 0);
   $42 = $$245 & 1;
   __tr_stored_block($0, 0, 0, $42);
   HEAP8[(HEAP32[$18 >> 2] | 0) + ((HEAP32[$17 >> 2] | 0) + -4) >> 0] = $$1215;
   HEAP8[(HEAP32[$18 >> 2] | 0) + ((HEAP32[$17 >> 2] | 0) + -3) >> 0] = $$1215 >>> 8;
   $54 = ~$$1215;
   HEAP8[(HEAP32[$18 >> 2] | 0) + ((HEAP32[$17 >> 2] | 0) + -2) >> 0] = $54;
   HEAP8[(HEAP32[$18 >> 2] | 0) + ((HEAP32[$17 >> 2] | 0) + -1) >> 0] = $54 >>> 8;
   $66 = HEAP32[$0 >> 2] | 0;
   $68 = HEAP32[$66 + 28 >> 2] | 0;
   __tr_flush_bits($68);
   $69 = $68 + 20 | 0;
   $70 = HEAP32[$69 >> 2] | 0;
   $71 = $66 + 16 | 0;
   $72 = HEAP32[$71 >> 2] | 0;
   $$$i = $70 >>> 0 > $72 >>> 0 ? $72 : $70;
   if ($$$i | 0) {
    $75 = $66 + 12 | 0;
    $77 = $68 + 16 | 0;
    _memcpy(HEAP32[$75 >> 2] | 0, HEAP32[$77 >> 2] | 0, $$$i | 0) | 0;
    HEAP32[$75 >> 2] = (HEAP32[$75 >> 2] | 0) + $$$i;
    HEAP32[$77 >> 2] = (HEAP32[$77 >> 2] | 0) + $$$i;
    $83 = $66 + 20 | 0;
    HEAP32[$83 >> 2] = (HEAP32[$83 >> 2] | 0) + $$$i;
    HEAP32[$71 >> 2] = (HEAP32[$71 >> 2] | 0) - $$$i;
    $89 = (HEAP32[$69 >> 2] | 0) - $$$i | 0;
    HEAP32[$69 >> 2] = $89;
    if (!$89) HEAP32[$77 >> 2] = HEAP32[$68 + 8 >> 2];
   }
   if (!$31) $$2216 = $$1215; else {
    $$1215$ = $31 >>> 0 > $$1215 >>> 0 ? $$1215 : $31;
    _memcpy(HEAP32[(HEAP32[$0 >> 2] | 0) + 12 >> 2] | 0, (HEAP32[$19 >> 2] | 0) + (HEAP32[$13 >> 2] | 0) | 0, $$1215$ | 0) | 0;
    $101 = HEAP32[$0 >> 2] | 0;
    $102 = $101 + 12 | 0;
    HEAP32[$102 >> 2] = (HEAP32[$102 >> 2] | 0) + $$1215$;
    $105 = $101 + 16 | 0;
    HEAP32[$105 >> 2] = (HEAP32[$105 >> 2] | 0) - $$1215$;
    $108 = $101 + 20 | 0;
    HEAP32[$108 >> 2] = (HEAP32[$108 >> 2] | 0) + $$1215$;
    HEAP32[$13 >> 2] = (HEAP32[$13 >> 2] | 0) + $$1215$;
    $$2216 = $$1215 - $$1215$ | 0;
   }
   if ($$2216 | 0) {
    $115 = HEAP32[$0 >> 2] | 0;
    $117 = HEAP32[$115 + 12 >> 2] | 0;
    $118 = $115 + 4 | 0;
    $119 = HEAP32[$118 >> 2] | 0;
    $$$i223 = $119 >>> 0 > $$2216 >>> 0 ? $$2216 : $119;
    if (!$$$i223) {
     $140 = $115;
     $142 = $117;
    } else {
     HEAP32[$118 >> 2] = $119 - $$$i223;
     _memcpy($117 | 0, HEAP32[$115 >> 2] | 0, $$$i223 | 0) | 0;
     switch (HEAP32[(HEAP32[$115 + 28 >> 2] | 0) + 24 >> 2] | 0) {
     case 1:
      {
       $128 = $115 + 48 | 0;
       HEAP32[$128 >> 2] = _adler32(HEAP32[$128 >> 2] | 0, $117, $$$i223) | 0;
       break;
      }
     case 2:
      {
       $131 = $115 + 48 | 0;
       HEAP32[$131 >> 2] = _crc32(HEAP32[$131 >> 2] | 0, $117, $$$i223) | 0;
       break;
      }
     default:
      {}
     }
     HEAP32[$115 >> 2] = (HEAP32[$115 >> 2] | 0) + $$$i223;
     $136 = $115 + 8 | 0;
     HEAP32[$136 >> 2] = (HEAP32[$136 >> 2] | 0) + $$$i223;
     $$pre230 = HEAP32[$0 >> 2] | 0;
     $140 = $$pre230;
     $142 = HEAP32[$$pre230 + 12 >> 2] | 0;
    }
    HEAP32[$140 + 12 >> 2] = $142 + $$2216;
    $143 = $140 + 16 | 0;
    HEAP32[$143 >> 2] = (HEAP32[$143 >> 2] | 0) - $$2216;
    $146 = $140 + 20 | 0;
    HEAP32[$146 >> 2] = (HEAP32[$146 >> 2] | 0) + $$2216;
   }
   $$pre233 = HEAP32[$0 >> 2] | 0;
   if ($$245) {
    $$1 = $42;
    $156 = $$pre233;
    break L1;
   }
   $27 = (HEAP32[$11 >> 2] | 0) + 42 >> 3;
   $28 = HEAP32[$$pre233 + 16 >> 2] | 0;
   if ($28 >>> 0 < $27 >>> 0) {
    $$1 = $42;
    $156 = $$pre233;
    break;
   } else {
    $$0249 = $42;
    $33 = $$pre233;
   }
  }
 } while (0);
 $158 = $10 - (HEAP32[$156 + 4 >> 2] | 0) | 0;
 if (!$158) $199 = HEAP32[$12 >> 2] | 0; else {
  $160 = HEAP32[$5 >> 2] | 0;
  if ($158 >>> 0 < $160 >>> 0) {
   $170 = HEAP32[$12 >> 2] | 0;
   if (((HEAP32[$0 + 60 >> 2] | 0) - $170 | 0) >>> 0 <= $158 >>> 0) {
    $173 = $170 - $160 | 0;
    HEAP32[$12 >> 2] = $173;
    $174 = HEAP32[$19 >> 2] | 0;
    _memcpy($174 | 0, $174 + $160 | 0, $173 | 0) | 0;
    $176 = $0 + 5808 | 0;
    $177 = HEAP32[$176 >> 2] | 0;
    if ($177 >>> 0 < 2) HEAP32[$176 >> 2] = $177 + 1;
   }
   _memcpy((HEAP32[$19 >> 2] | 0) + (HEAP32[$12 >> 2] | 0) | 0, (HEAP32[HEAP32[$0 >> 2] >> 2] | 0) + (0 - $158) | 0, $158 | 0) | 0;
   $188 = (HEAP32[$12 >> 2] | 0) + $158 | 0;
   HEAP32[$12 >> 2] = $188;
   $189 = $188;
   $193 = HEAP32[$5 >> 2] | 0;
  } else {
   HEAP32[$0 + 5808 >> 2] = 2;
   _memcpy(HEAP32[$19 >> 2] | 0, (HEAP32[$156 >> 2] | 0) + (0 - $160) | 0, $160 | 0) | 0;
   $167 = HEAP32[$5 >> 2] | 0;
   HEAP32[$12 >> 2] = $167;
   $189 = $167;
   $193 = $167;
  }
  HEAP32[$13 >> 2] = $189;
  $190 = $0 + 5812 | 0;
  $191 = HEAP32[$190 >> 2] | 0;
  $192 = $193 - $191 | 0;
  HEAP32[$190 >> 2] = ($158 >>> 0 > $192 >>> 0 ? $192 : $158) + $191;
  $199 = $189;
 }
 $196 = $0 + 5824 | 0;
 if ((HEAP32[$196 >> 2] | 0) >>> 0 < $199 >>> 0) HEAP32[$196 >> 2] = $199;
 if ($$1 | 0) {
  $$0217 = 3;
  return $$0217 | 0;
 }
 $201 = ($1 | 0) != 0;
 switch ($1 | 0) {
 case 0:
 case 4:
  break;
 default:
  if (!(HEAP32[(HEAP32[$0 >> 2] | 0) + 4 >> 2] | 0)) if (($199 | 0) == (HEAP32[$13 >> 2] | 0)) {
   $$0217 = 1;
   return $$0217 | 0;
  }
 }
 $211 = (HEAP32[$0 + 60 >> 2] | 0) - $199 + -1 | 0;
 $212 = HEAP32[$0 >> 2] | 0;
 $214 = HEAP32[$212 + 4 >> 2] | 0;
 if ($214 >>> 0 > $211 >>> 0) {
  $216 = HEAP32[$13 >> 2] | 0;
  $217 = HEAP32[$5 >> 2] | 0;
  if (($216 | 0) < ($217 | 0)) {
   $$0211 = $211;
   $230 = $214;
   $233 = $212;
  } else {
   HEAP32[$13 >> 2] = $216 - $217;
   $220 = $199 - $217 | 0;
   HEAP32[$12 >> 2] = $220;
   $221 = HEAP32[$19 >> 2] | 0;
   _memcpy($221 | 0, $221 + $217 | 0, $220 | 0) | 0;
   $223 = $0 + 5808 | 0;
   $224 = HEAP32[$223 >> 2] | 0;
   if ($224 >>> 0 < 2) HEAP32[$223 >> 2] = $224 + 1;
   $$pre237 = HEAP32[$0 >> 2] | 0;
   $$0211 = (HEAP32[$5 >> 2] | 0) + $211 | 0;
   $230 = HEAP32[$$pre237 + 4 >> 2] | 0;
   $233 = $$pre237;
  }
 } else {
  $$0211 = $211;
  $230 = $214;
  $233 = $212;
 }
 $$$0211 = $$0211 >>> 0 > $230 >>> 0 ? $230 : $$0211;
 if (!$$$0211) $258 = HEAP32[$12 >> 2] | 0; else {
  $236 = (HEAP32[$19 >> 2] | 0) + (HEAP32[$12 >> 2] | 0) | 0;
  HEAP32[$233 + 4 >> 2] = $230 - $$$0211;
  _memcpy($236 | 0, HEAP32[$233 >> 2] | 0, $$$0211 | 0) | 0;
  switch (HEAP32[(HEAP32[$233 + 28 >> 2] | 0) + 24 >> 2] | 0) {
  case 1:
   {
    $243 = $233 + 48 | 0;
    HEAP32[$243 >> 2] = _adler32(HEAP32[$243 >> 2] | 0, $236, $$$0211) | 0;
    break;
   }
  case 2:
   {
    $246 = $233 + 48 | 0;
    HEAP32[$246 >> 2] = _crc32(HEAP32[$246 >> 2] | 0, $236, $$$0211) | 0;
    break;
   }
  default:
   {}
  }
  HEAP32[$233 >> 2] = (HEAP32[$233 >> 2] | 0) + $$$0211;
  $251 = $233 + 8 | 0;
  HEAP32[$251 >> 2] = (HEAP32[$251 >> 2] | 0) + $$$0211;
  $255 = (HEAP32[$12 >> 2] | 0) + $$$0211 | 0;
  HEAP32[$12 >> 2] = $255;
  $258 = $255;
 }
 if ((HEAP32[$196 >> 2] | 0) >>> 0 < $258 >>> 0) HEAP32[$196 >> 2] = $258;
 $263 = (HEAP32[$2 >> 2] | 0) - ((HEAP32[$11 >> 2] | 0) + 42 >> 3) | 0;
 $$220 = $263 >>> 0 > 65535 ? 65535 : $263;
 $265 = HEAP32[$5 >> 2] | 0;
 $268 = HEAP32[$13 >> 2] | 0;
 $269 = $258 - $268 | 0;
 if ($269 >>> 0 < ($$220 >>> 0 > $265 >>> 0 ? $265 : $$220) >>> 0) if ($201 & ($16 | ($269 | 0) != 0)) if ($269 >>> 0 > $$220 >>> 0 ? 1 : (HEAP32[(HEAP32[$0 >> 2] | 0) + 4 >> 2] | 0) != 0) $$2 = 0; else label = 49; else $$2 = 0; else label = 49;
 if ((label | 0) == 49) {
  $278 = $269 >>> 0 > $$220 >>> 0 ? $$220 : $269;
  if ($16) $285 = ($278 | 0) == ($269 | 0) ? (HEAP32[(HEAP32[$0 >> 2] | 0) + 4 >> 2] | 0) == 0 : 0; else $285 = 0;
  $284 = $285 & 1;
  __tr_stored_block($0, (HEAP32[$19 >> 2] | 0) + $268 | 0, $278, $284);
  HEAP32[$13 >> 2] = (HEAP32[$13 >> 2] | 0) + $278;
  $290 = HEAP32[$0 >> 2] | 0;
  $292 = HEAP32[$290 + 28 >> 2] | 0;
  __tr_flush_bits($292);
  $293 = $292 + 20 | 0;
  $294 = HEAP32[$293 >> 2] | 0;
  $295 = $290 + 16 | 0;
  $296 = HEAP32[$295 >> 2] | 0;
  $$$i227 = $294 >>> 0 > $296 >>> 0 ? $296 : $294;
  if (!$$$i227) $$2 = $284; else {
   $299 = $290 + 12 | 0;
   $301 = $292 + 16 | 0;
   _memcpy(HEAP32[$299 >> 2] | 0, HEAP32[$301 >> 2] | 0, $$$i227 | 0) | 0;
   HEAP32[$299 >> 2] = (HEAP32[$299 >> 2] | 0) + $$$i227;
   HEAP32[$301 >> 2] = (HEAP32[$301 >> 2] | 0) + $$$i227;
   $307 = $290 + 20 | 0;
   HEAP32[$307 >> 2] = (HEAP32[$307 >> 2] | 0) + $$$i227;
   HEAP32[$295 >> 2] = (HEAP32[$295 >> 2] | 0) - $$$i227;
   $313 = (HEAP32[$293 >> 2] | 0) - $$$i227 | 0;
   HEAP32[$293 >> 2] = $313;
   if (!$313) {
    HEAP32[$301 >> 2] = HEAP32[$292 + 8 >> 2];
    $$2 = $284;
   } else $$2 = $284;
  }
 }
 $$0217 = $$2 | 0 ? 2 : 0;
 return $$0217 | 0;
}

function _deflate_fast($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$$i = 0, $$$i138 = 0, $$$i140 = 0, $$0 = 0, $$0135 = 0, $$pre144 = 0, $$pre145 = 0, $$pre146 = 0, $$pre147 = 0, $$pre148 = 0, $$pre149 = 0, $10 = 0, $101 = 0, $108 = 0, $11 = 0, $114 = 0, $116 = 0, $118 = 0, $119 = 0, $12 = 0, $122 = 0, $13 = 0, $135 = 0, $136 = 0, $14 = 0, $143 = 0, $15 = 0, $150 = 0, $154 = 0, $156 = 0, $16 = 0, $161 = 0, $162 = 0, $164 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $173 = 0, $175 = 0, $18 = 0, $181 = 0, $187 = 0, $19 = 0, $195 = 0, $199 = 0, $2 = 0, $20 = 0, $204 = 0, $206 = 0, $208 = 0, $209 = 0, $210 = 0, $211 = 0, $212 = 0, $215 = 0, $217 = 0, $223 = 0, $229 = 0, $23 = 0, $239 = 0, $244 = 0, $246 = 0, $248 = 0, $249 = 0, $250 = 0, $251 = 0, $252 = 0, $255 = 0, $257 = 0, $263 = 0, $269 = 0, $3 = 0, $30 = 0, $38 = 0, $4 = 0, $40 = 0, $41 = 0, $46 = 0, $5 = 0, $53 = 0, $54 = 0, $56 = 0, $6 = 0, $60 = 0, $62 = 0, $7 = 0, $75 = 0, $78 = 0, $8 = 0, $83 = 0, $9 = 0, $90 = 0, $91 = 0, $93 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0;
 $2 = $0 + 116 | 0;
 $3 = ($1 | 0) == 0;
 $4 = $0 + 72 | 0;
 $5 = $0 + 88 | 0;
 $6 = $0 + 108 | 0;
 $7 = $0 + 56 | 0;
 $8 = $0 + 84 | 0;
 $9 = $0 + 68 | 0;
 $10 = $0 + 52 | 0;
 $11 = $0 + 64 | 0;
 $12 = $0 + 44 | 0;
 $13 = $0 + 96 | 0;
 $14 = $0 + 112 | 0;
 $15 = $0 + 5792 | 0;
 $16 = $0 + 5796 | 0;
 $17 = $0 + 5784 | 0;
 $18 = $0 + 5788 | 0;
 $19 = $0 + 128 | 0;
 $20 = $0 + 92 | 0;
 while (1) {
  if ((HEAP32[$2 >> 2] | 0) >>> 0 < 262) {
   _fill_window($0);
   $23 = HEAP32[$2 >> 2] | 0;
   if ($3 & $23 >>> 0 < 262) {
    $$0 = 0;
    label = 39;
    break;
   }
   if (!$23) {
    label = 24;
    break;
   }
   if ($23 >>> 0 > 2) label = 6; else label = 9;
  } else label = 6;
  if ((label | 0) == 6) {
   label = 0;
   $30 = HEAP32[$6 >> 2] | 0;
   $38 = ((HEAPU8[(HEAP32[$7 >> 2] | 0) + ($30 + 2) >> 0] | 0) ^ HEAP32[$4 >> 2] << HEAP32[$5 >> 2]) & HEAP32[$8 >> 2];
   HEAP32[$4 >> 2] = $38;
   $40 = (HEAP32[$9 >> 2] | 0) + ($38 << 1) | 0;
   $41 = HEAP16[$40 >> 1] | 0;
   HEAP16[(HEAP32[$11 >> 2] | 0) + ((HEAP32[$10 >> 2] & $30) << 1) >> 1] = $41;
   $46 = $41 & 65535;
   HEAP16[$40 >> 1] = $30;
   if (!($41 << 16 >> 16)) label = 9; else if (($30 - $46 | 0) >>> 0 > ((HEAP32[$12 >> 2] | 0) + -262 | 0) >>> 0) label = 9; else {
    $53 = _longest_match($0, $46) | 0;
    HEAP32[$13 >> 2] = $53;
    $54 = $53;
   }
  }
  if ((label | 0) == 9) {
   label = 0;
   $54 = HEAP32[$13 >> 2] | 0;
  }
  do if ($54 >>> 0 > 2) {
   $56 = $54 + 253 | 0;
   $60 = (HEAP32[$6 >> 2] | 0) - (HEAP32[$14 >> 2] | 0) | 0;
   $62 = HEAP32[$15 >> 2] | 0;
   HEAP16[(HEAP32[$16 >> 2] | 0) + ($62 << 1) >> 1] = $60;
   HEAP32[$15 >> 2] = $62 + 1;
   HEAP8[(HEAP32[$17 >> 2] | 0) + $62 >> 0] = $56;
   $75 = $0 + 148 + ((HEAPU8[13012 + ($56 & 255) >> 0] | 0 | 256) + 1 << 2) | 0;
   HEAP16[$75 >> 1] = (HEAP16[$75 >> 1] | 0) + 1 << 16 >> 16;
   $78 = $60 + 65535 & 65535;
   $83 = $0 + 2440 + ((HEAPU8[12500 + ($78 >>> 0 < 256 ? $78 : ($78 >>> 7) + 256 | 0) >> 0] | 0) << 2) | 0;
   HEAP16[$83 >> 1] = (HEAP16[$83 >> 1] | 0) + 1 << 16 >> 16;
   $90 = (HEAP32[$15 >> 2] | 0) == ((HEAP32[$18 >> 2] | 0) + -1 | 0) & 1;
   $91 = HEAP32[$13 >> 2] | 0;
   $93 = (HEAP32[$2 >> 2] | 0) - $91 | 0;
   HEAP32[$2 >> 2] = $93;
   if (!($93 >>> 0 > 2 ? $91 >>> 0 <= (HEAP32[$19 >> 2] | 0) >>> 0 : 0)) {
    $118 = (HEAP32[$6 >> 2] | 0) + $91 | 0;
    HEAP32[$6 >> 2] = $118;
    HEAP32[$13 >> 2] = 0;
    $119 = HEAP32[$7 >> 2] | 0;
    $122 = HEAPU8[$119 + $118 >> 0] | 0;
    HEAP32[$4 >> 2] = $122;
    HEAP32[$4 >> 2] = ((HEAPU8[$119 + ($118 + 1) >> 0] | 0) ^ $122 << HEAP32[$5 >> 2]) & HEAP32[$8 >> 2];
    $$0135 = $90;
    $161 = $118;
    break;
   }
   $97 = $91 + -1 | 0;
   HEAP32[$13 >> 2] = $97;
   $$pre144 = HEAP32[$5 >> 2] | 0;
   $$pre145 = HEAP32[$7 >> 2] | 0;
   $$pre146 = HEAP32[$8 >> 2] | 0;
   $$pre147 = HEAP32[$9 >> 2] | 0;
   $$pre148 = HEAP32[$10 >> 2] | 0;
   $$pre149 = HEAP32[$11 >> 2] | 0;
   $101 = HEAP32[$4 >> 2] | 0;
   $114 = $97;
   $99 = HEAP32[$6 >> 2] | 0;
   while (1) {
    $98 = $99 + 1 | 0;
    HEAP32[$6 >> 2] = $98;
    $101 = ((HEAPU8[$$pre145 + ($99 + 3) >> 0] | 0) ^ $101 << $$pre144) & $$pre146;
    HEAP32[$4 >> 2] = $101;
    $108 = $$pre147 + ($101 << 1) | 0;
    HEAP16[$$pre149 + (($$pre148 & $98) << 1) >> 1] = HEAP16[$108 >> 1] | 0;
    HEAP16[$108 >> 1] = $98;
    $114 = $114 + -1 | 0;
    HEAP32[$13 >> 2] = $114;
    if (!$114) break; else $99 = $98;
   }
   $116 = $99 + 2 | 0;
   HEAP32[$6 >> 2] = $116;
   $$0135 = $90;
   $161 = $116;
  } else {
   $135 = HEAP8[(HEAP32[$7 >> 2] | 0) + (HEAP32[$6 >> 2] | 0) >> 0] | 0;
   $136 = HEAP32[$15 >> 2] | 0;
   HEAP16[(HEAP32[$16 >> 2] | 0) + ($136 << 1) >> 1] = 0;
   HEAP32[$15 >> 2] = $136 + 1;
   HEAP8[(HEAP32[$17 >> 2] | 0) + $136 >> 0] = $135;
   $143 = $0 + 148 + (($135 & 255) << 2) | 0;
   HEAP16[$143 >> 1] = (HEAP16[$143 >> 1] | 0) + 1 << 16 >> 16;
   $150 = (HEAP32[$15 >> 2] | 0) == ((HEAP32[$18 >> 2] | 0) + -1 | 0) & 1;
   HEAP32[$2 >> 2] = (HEAP32[$2 >> 2] | 0) + -1;
   $154 = (HEAP32[$6 >> 2] | 0) + 1 | 0;
   HEAP32[$6 >> 2] = $154;
   $$0135 = $150;
   $161 = $154;
  } while (0);
  if (!$$0135) continue;
  $156 = HEAP32[$20 >> 2] | 0;
  if (($156 | 0) > -1) $162 = (HEAP32[$7 >> 2] | 0) + $156 | 0; else $162 = 0;
  __tr_flush_block($0, $162, $161 - $156 | 0, 0);
  HEAP32[$20 >> 2] = HEAP32[$6 >> 2];
  $164 = HEAP32[$0 >> 2] | 0;
  $166 = HEAP32[$164 + 28 >> 2] | 0;
  __tr_flush_bits($166);
  $167 = $166 + 20 | 0;
  $168 = HEAP32[$167 >> 2] | 0;
  $169 = $164 + 16 | 0;
  $170 = HEAP32[$169 >> 2] | 0;
  $$$i = $168 >>> 0 > $170 >>> 0 ? $170 : $168;
  if ($$$i | 0) {
   $173 = $164 + 12 | 0;
   $175 = $166 + 16 | 0;
   _memcpy(HEAP32[$173 >> 2] | 0, HEAP32[$175 >> 2] | 0, $$$i | 0) | 0;
   HEAP32[$173 >> 2] = (HEAP32[$173 >> 2] | 0) + $$$i;
   HEAP32[$175 >> 2] = (HEAP32[$175 >> 2] | 0) + $$$i;
   $181 = $164 + 20 | 0;
   HEAP32[$181 >> 2] = (HEAP32[$181 >> 2] | 0) + $$$i;
   HEAP32[$169 >> 2] = (HEAP32[$169 >> 2] | 0) - $$$i;
   $187 = (HEAP32[$167 >> 2] | 0) - $$$i | 0;
   HEAP32[$167 >> 2] = $187;
   if (!$187) HEAP32[$175 >> 2] = HEAP32[$166 + 8 >> 2];
  }
  if (!(HEAP32[(HEAP32[$0 >> 2] | 0) + 16 >> 2] | 0)) {
   $$0 = 0;
   label = 39;
   break;
  }
 }
 if ((label | 0) == 24) {
  $195 = HEAP32[$6 >> 2] | 0;
  HEAP32[$0 + 5812 >> 2] = $195 >>> 0 < 2 ? $195 : 2;
  if (($1 | 0) == 4) {
   $199 = HEAP32[$20 >> 2] | 0;
   if (($199 | 0) > -1) $204 = (HEAP32[$7 >> 2] | 0) + $199 | 0; else $204 = 0;
   __tr_flush_block($0, $204, $195 - $199 | 0, 1);
   HEAP32[$20 >> 2] = HEAP32[$6 >> 2];
   $206 = HEAP32[$0 >> 2] | 0;
   $208 = HEAP32[$206 + 28 >> 2] | 0;
   __tr_flush_bits($208);
   $209 = $208 + 20 | 0;
   $210 = HEAP32[$209 >> 2] | 0;
   $211 = $206 + 16 | 0;
   $212 = HEAP32[$211 >> 2] | 0;
   $$$i138 = $210 >>> 0 > $212 >>> 0 ? $212 : $210;
   if ($$$i138 | 0) {
    $215 = $206 + 12 | 0;
    $217 = $208 + 16 | 0;
    _memcpy(HEAP32[$215 >> 2] | 0, HEAP32[$217 >> 2] | 0, $$$i138 | 0) | 0;
    HEAP32[$215 >> 2] = (HEAP32[$215 >> 2] | 0) + $$$i138;
    HEAP32[$217 >> 2] = (HEAP32[$217 >> 2] | 0) + $$$i138;
    $223 = $206 + 20 | 0;
    HEAP32[$223 >> 2] = (HEAP32[$223 >> 2] | 0) + $$$i138;
    HEAP32[$211 >> 2] = (HEAP32[$211 >> 2] | 0) - $$$i138;
    $229 = (HEAP32[$209 >> 2] | 0) - $$$i138 | 0;
    HEAP32[$209 >> 2] = $229;
    if (!$229) HEAP32[$217 >> 2] = HEAP32[$208 + 8 >> 2];
   }
   $$0 = (HEAP32[(HEAP32[$0 >> 2] | 0) + 16 >> 2] | 0) == 0 ? 2 : 3;
   return $$0 | 0;
  }
  if (HEAP32[$15 >> 2] | 0) {
   $239 = HEAP32[$20 >> 2] | 0;
   if (($239 | 0) > -1) $244 = (HEAP32[$7 >> 2] | 0) + $239 | 0; else $244 = 0;
   __tr_flush_block($0, $244, $195 - $239 | 0, 0);
   HEAP32[$20 >> 2] = HEAP32[$6 >> 2];
   $246 = HEAP32[$0 >> 2] | 0;
   $248 = HEAP32[$246 + 28 >> 2] | 0;
   __tr_flush_bits($248);
   $249 = $248 + 20 | 0;
   $250 = HEAP32[$249 >> 2] | 0;
   $251 = $246 + 16 | 0;
   $252 = HEAP32[$251 >> 2] | 0;
   $$$i140 = $250 >>> 0 > $252 >>> 0 ? $252 : $250;
   if ($$$i140 | 0) {
    $255 = $246 + 12 | 0;
    $257 = $248 + 16 | 0;
    _memcpy(HEAP32[$255 >> 2] | 0, HEAP32[$257 >> 2] | 0, $$$i140 | 0) | 0;
    HEAP32[$255 >> 2] = (HEAP32[$255 >> 2] | 0) + $$$i140;
    HEAP32[$257 >> 2] = (HEAP32[$257 >> 2] | 0) + $$$i140;
    $263 = $246 + 20 | 0;
    HEAP32[$263 >> 2] = (HEAP32[$263 >> 2] | 0) + $$$i140;
    HEAP32[$251 >> 2] = (HEAP32[$251 >> 2] | 0) - $$$i140;
    $269 = (HEAP32[$249 >> 2] | 0) - $$$i140 | 0;
    HEAP32[$249 >> 2] = $269;
    if (!$269) HEAP32[$257 >> 2] = HEAP32[$248 + 8 >> 2];
   }
   if (!(HEAP32[(HEAP32[$0 >> 2] | 0) + 16 >> 2] | 0)) {
    $$0 = 0;
    return $$0 | 0;
   }
  }
  $$0 = 1;
  return $$0 | 0;
 } else if ((label | 0) == 39) return $$0 | 0;
 return 0;
}

function _send_tree($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0 = 0, $$0$ph = 0, $$0255$ph = 0, $$0255$ph$phi = 0, $$0256$ph = 0, $$0257 = 0, $$1258 = 0, $$1260$ph = 0, $$1263$ph = 0, $$2 = 0, $10 = 0, $102 = 0, $105 = 0, $106 = 0, $109 = 0, $11 = 0, $115 = 0, $116 = 0, $12 = 0, $120 = 0, $122 = 0, $127 = 0, $13 = 0, $130 = 0, $133 = 0, $134 = 0, $137 = 0, $14 = 0, $143 = 0, $144 = 0, $148 = 0, $15 = 0, $156 = 0, $157 = 0, $16 = 0, $161 = 0, $165 = 0, $168 = 0, $174 = 0, $175 = 0, $179 = 0, $181 = 0, $186 = 0, $189 = 0, $192 = 0, $193 = 0, $196 = 0, $20 = 0, $202 = 0, $203 = 0, $207 = 0, $21 = 0, $214 = 0, $215 = 0, $219 = 0, $22 = 0, $223 = 0, $226 = 0, $232 = 0, $233 = 0, $237 = 0, $239 = 0, $24 = 0, $244 = 0, $247 = 0, $250 = 0, $251 = 0, $254 = 0, $26 = 0, $260 = 0, $261 = 0, $265 = 0, $27 = 0, $271 = 0, $273 = 0, $274 = 0, $29 = 0, $31 = 0, $34 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $41 = 0, $47 = 0, $48 = 0, $52 = 0, $55 = 0, $6 = 0, $65 = 0, $66 = 0, $7 = 0, $71 = 0, $75 = 0, $76 = 0, $78 = 0, $8 = 0, $84 = 0, $85 = 0, $89 = 0, $9 = 0, $92 = 0, $97 = 0, $99 = 0, $storemerge265 = 0, $storemerge267 = 0, $storemerge269 = 0, $storemerge270 = 0, $storemerge271 = 0;
 $4 = HEAP16[$1 + 2 >> 1] | 0;
 $6 = $4 << 16 >> 16 == 0;
 $7 = $0 + 2754 | 0;
 $8 = $0 + 5820 | 0;
 $9 = $0 + 2752 | 0;
 $10 = $0 + 5816 | 0;
 $11 = $0 + 20 | 0;
 $12 = $0 + 8 | 0;
 $13 = $0 + 2758 | 0;
 $14 = $0 + 2756 | 0;
 $15 = $0 + 2750 | 0;
 $16 = $0 + 2748 | 0;
 $$0$ph = 0;
 $$0255$ph = -1;
 $$0256$ph = $4 & 65535;
 $$1260$ph = $6 ? 138 : 7;
 $$1263$ph = $6 ? 3 : 4;
 L1 : while (1) {
  $$0 = $$0$ph;
  $$0257 = 0;
  while (1) {
   if (($$0 | 0) > ($2 | 0)) break L1;
   $$0 = $$0 + 1 | 0;
   $20 = HEAP16[$1 + ($$0 << 2) + 2 >> 1] | 0;
   $21 = $20 & 65535;
   $22 = $$0257 + 1 | 0;
   $24 = ($$0256$ph | 0) == ($21 | 0);
   if (!(($22 | 0) < ($$1260$ph | 0) & $24)) break; else $$0257 = $22;
  }
  do if (($22 | 0) < ($$1263$ph | 0)) {
   $26 = $0 + 2684 + ($$0256$ph << 2) + 2 | 0;
   $27 = $0 + 2684 + ($$0256$ph << 2) | 0;
   $$1258 = $22;
   $31 = HEAP32[$8 >> 2] | 0;
   $37 = HEAP16[$10 >> 1] | 0;
   while (1) {
    $29 = HEAPU16[$26 >> 1] | 0;
    $34 = HEAPU16[$27 >> 1] | 0;
    $38 = $37 & 65535 | $34 << $31;
    $39 = $38 & 65535;
    HEAP16[$10 >> 1] = $39;
    if (($31 | 0) > (16 - $29 | 0)) {
     $41 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $41 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $41 >> 0] = $38;
     $47 = (HEAPU16[$10 >> 1] | 0) >>> 8 & 255;
     $48 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $48 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $48 >> 0] = $47;
     $52 = HEAP32[$8 >> 2] | 0;
     $55 = $34 >>> (16 - $52 | 0) & 65535;
     HEAP16[$10 >> 1] = $55;
     $273 = $55;
     $storemerge271 = $29 + -16 + $52 | 0;
    } else {
     $273 = $39;
     $storemerge271 = $31 + $29 | 0;
    }
    HEAP32[$8 >> 2] = $storemerge271;
    $$1258 = $$1258 + -1 | 0;
    if (!$$1258) break; else {
     $31 = $storemerge271;
     $37 = $273;
    }
   }
  } else {
   if ($$0256$ph | 0) {
    if (($$0256$ph | 0) == ($$0255$ph | 0)) {
     $$2 = $22;
     $105 = HEAP16[$10 >> 1] | 0;
     $99 = HEAP32[$8 >> 2] | 0;
    } else {
     $65 = HEAPU16[$0 + 2684 + ($$0256$ph << 2) + 2 >> 1] | 0;
     $66 = HEAP32[$8 >> 2] | 0;
     $71 = HEAPU16[$0 + 2684 + ($$0256$ph << 2) >> 1] | 0;
     $75 = HEAPU16[$10 >> 1] | 0 | $71 << $66;
     $76 = $75 & 65535;
     HEAP16[$10 >> 1] = $76;
     if (($66 | 0) > (16 - $65 | 0)) {
      $78 = HEAP32[$11 >> 2] | 0;
      HEAP32[$11 >> 2] = $78 + 1;
      HEAP8[(HEAP32[$12 >> 2] | 0) + $78 >> 0] = $75;
      $84 = (HEAPU16[$10 >> 1] | 0) >>> 8 & 255;
      $85 = HEAP32[$11 >> 2] | 0;
      HEAP32[$11 >> 2] = $85 + 1;
      HEAP8[(HEAP32[$12 >> 2] | 0) + $85 >> 0] = $84;
      $89 = HEAP32[$8 >> 2] | 0;
      $92 = $71 >>> (16 - $89 | 0) & 65535;
      HEAP16[$10 >> 1] = $92;
      $274 = $92;
      $storemerge270 = $65 + -16 + $89 | 0;
     } else {
      $274 = $76;
      $storemerge270 = $66 + $65 | 0;
     }
     HEAP32[$8 >> 2] = $storemerge270;
     $$2 = $$0257;
     $105 = $274;
     $99 = $storemerge270;
    }
    $97 = HEAPU16[$15 >> 1] | 0;
    $102 = HEAPU16[$16 >> 1] | 0;
    $106 = $105 & 65535 | $102 << $99;
    HEAP16[$10 >> 1] = $106;
    if (($99 | 0) > (16 - $97 | 0)) {
     $109 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $109 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $109 >> 0] = $106;
     $115 = (HEAPU16[$10 >> 1] | 0) >>> 8 & 255;
     $116 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $116 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $116 >> 0] = $115;
     $120 = HEAP32[$8 >> 2] | 0;
     $122 = $102 >>> (16 - $120 | 0);
     HEAP16[$10 >> 1] = $122;
     $127 = $97 + -16 + $120 | 0;
     $133 = $122;
    } else {
     $127 = $99 + $97 | 0;
     $133 = $106;
    }
    HEAP32[$8 >> 2] = $127;
    $130 = $$2 + 65533 & 65535;
    $134 = $133 & 65535 | $130 << $127;
    HEAP16[$10 >> 1] = $134;
    if (($127 | 0) > 14) {
     $137 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $137 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $137 >> 0] = $134;
     $143 = (HEAPU16[$10 >> 1] | 0) >>> 8 & 255;
     $144 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $144 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $144 >> 0] = $143;
     $148 = HEAP32[$8 >> 2] | 0;
     HEAP16[$10 >> 1] = $130 >>> (16 - $148 | 0);
     $storemerge269 = $148 + -14 | 0;
    } else $storemerge269 = $127 + 2 | 0;
    HEAP32[$8 >> 2] = $storemerge269;
    break;
   }
   if (($22 | 0) < 11) {
    $156 = HEAPU16[$7 >> 1] | 0;
    $157 = HEAP32[$8 >> 2] | 0;
    $161 = HEAPU16[$9 >> 1] | 0;
    $165 = HEAPU16[$10 >> 1] | 0 | $161 << $157;
    HEAP16[$10 >> 1] = $165;
    if (($157 | 0) > (16 - $156 | 0)) {
     $168 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $168 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $168 >> 0] = $165;
     $174 = (HEAPU16[$10 >> 1] | 0) >>> 8 & 255;
     $175 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $175 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $175 >> 0] = $174;
     $179 = HEAP32[$8 >> 2] | 0;
     $181 = $161 >>> (16 - $179 | 0);
     HEAP16[$10 >> 1] = $181;
     $186 = $156 + -16 + $179 | 0;
     $192 = $181;
    } else {
     $186 = $157 + $156 | 0;
     $192 = $165;
    }
    HEAP32[$8 >> 2] = $186;
    $189 = $$0257 + 65534 & 65535;
    $193 = $192 & 65535 | $189 << $186;
    HEAP16[$10 >> 1] = $193;
    if (($186 | 0) > 13) {
     $196 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $196 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $196 >> 0] = $193;
     $202 = (HEAPU16[$10 >> 1] | 0) >>> 8 & 255;
     $203 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $203 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $203 >> 0] = $202;
     $207 = HEAP32[$8 >> 2] | 0;
     HEAP16[$10 >> 1] = $189 >>> (16 - $207 | 0);
     $storemerge267 = $207 + -13 | 0;
    } else $storemerge267 = $186 + 3 | 0;
    HEAP32[$8 >> 2] = $storemerge267;
    break;
   } else {
    $214 = HEAPU16[$13 >> 1] | 0;
    $215 = HEAP32[$8 >> 2] | 0;
    $219 = HEAPU16[$14 >> 1] | 0;
    $223 = HEAPU16[$10 >> 1] | 0 | $219 << $215;
    HEAP16[$10 >> 1] = $223;
    if (($215 | 0) > (16 - $214 | 0)) {
     $226 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $226 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $226 >> 0] = $223;
     $232 = (HEAPU16[$10 >> 1] | 0) >>> 8 & 255;
     $233 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $233 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $233 >> 0] = $232;
     $237 = HEAP32[$8 >> 2] | 0;
     $239 = $219 >>> (16 - $237 | 0);
     HEAP16[$10 >> 1] = $239;
     $244 = $214 + -16 + $237 | 0;
     $250 = $239;
    } else {
     $244 = $215 + $214 | 0;
     $250 = $223;
    }
    HEAP32[$8 >> 2] = $244;
    $247 = $$0257 + 65526 & 65535;
    $251 = $250 & 65535 | $247 << $244;
    HEAP16[$10 >> 1] = $251;
    if (($244 | 0) > 9) {
     $254 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $254 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $254 >> 0] = $251;
     $260 = (HEAPU16[$10 >> 1] | 0) >>> 8 & 255;
     $261 = HEAP32[$11 >> 2] | 0;
     HEAP32[$11 >> 2] = $261 + 1;
     HEAP8[(HEAP32[$12 >> 2] | 0) + $261 >> 0] = $260;
     $265 = HEAP32[$8 >> 2] | 0;
     HEAP16[$10 >> 1] = $247 >>> (16 - $265 | 0);
     $storemerge265 = $265 + -9 | 0;
    } else $storemerge265 = $244 + 7 | 0;
    HEAP32[$8 >> 2] = $storemerge265;
    break;
   }
  } while (0);
  $271 = $20 << 16 >> 16 == 0;
  $$0255$ph$phi = $$0256$ph;
  $$0$ph = $$0;
  $$0256$ph = $21;
  $$1260$ph = $271 ? 138 : $24 ? 6 : 7;
  $$1263$ph = $271 | $24 ? 3 : 4;
  $$0255$ph = $$0255$ph$phi;
 }
 return;
}

function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
 $a$0 = $a$0 | 0;
 $a$1 = $a$1 | 0;
 $b$0 = $b$0 | 0;
 $b$1 = $b$1 | 0;
 $rem = $rem | 0;
 var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $_0$0 = 0, $_0$1 = 0, $q_sroa_1_1198$looptemp = 0;
 $n_sroa_0_0_extract_trunc = $a$0;
 $n_sroa_1_4_extract_shift$0 = $a$1;
 $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
 $d_sroa_0_0_extract_trunc = $b$0;
 $d_sroa_1_4_extract_shift$0 = $b$1;
 $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
 if (!$n_sroa_1_4_extract_trunc) {
  $4 = ($rem | 0) != 0;
  if (!$d_sroa_1_4_extract_trunc) {
   if ($4) {
    HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
    HEAP32[$rem + 4 >> 2] = 0;
   }
   $_0$1 = 0;
   $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  } else {
   if (!$4) {
    $_0$1 = 0;
    $_0$0 = 0;
    return (tempRet0 = $_0$1, $_0$0) | 0;
   }
   HEAP32[$rem >> 2] = $a$0 | 0;
   HEAP32[$rem + 4 >> 2] = $a$1 & 0;
   $_0$1 = 0;
   $_0$0 = 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
 }
 $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
 do if (!$d_sroa_0_0_extract_trunc) {
  if ($17) {
   if ($rem | 0) {
    HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
    HEAP32[$rem + 4 >> 2] = 0;
   }
   $_0$1 = 0;
   $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
  if (!$n_sroa_0_0_extract_trunc) {
   if ($rem | 0) {
    HEAP32[$rem >> 2] = 0;
    HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
   }
   $_0$1 = 0;
   $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
  $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
  if (!($37 & $d_sroa_1_4_extract_trunc)) {
   if ($rem | 0) {
    HEAP32[$rem >> 2] = $a$0 | 0;
    HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
   }
   $_0$1 = 0;
   $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
  $51 = (Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0) - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
  if ($51 >>> 0 <= 30) {
   $57 = $51 + 1 | 0;
   $58 = 31 - $51 | 0;
   $sr_1_ph = $57;
   $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
   $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
   $q_sroa_0_1_ph = 0;
   $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
   break;
  }
  if (!$rem) {
   $_0$1 = 0;
   $_0$0 = 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
  HEAP32[$rem >> 2] = $a$0 | 0;
  HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
  $_0$1 = 0;
  $_0$0 = 0;
  return (tempRet0 = $_0$1, $_0$0) | 0;
 } else {
  if (!$17) {
   $119 = (Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0) - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
   if ($119 >>> 0 <= 31) {
    $125 = $119 + 1 | 0;
    $126 = 31 - $119 | 0;
    $130 = $119 - 31 >> 31;
    $sr_1_ph = $125;
    $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
    $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
    $q_sroa_0_1_ph = 0;
    $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
    break;
   }
   if (!$rem) {
    $_0$1 = 0;
    $_0$0 = 0;
    return (tempRet0 = $_0$1, $_0$0) | 0;
   }
   HEAP32[$rem >> 2] = $a$0 | 0;
   HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
   $_0$1 = 0;
   $_0$0 = 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
  $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
  if ($66 & $d_sroa_0_0_extract_trunc | 0) {
   $88 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
   $89 = 64 - $88 | 0;
   $91 = 32 - $88 | 0;
   $92 = $91 >> 31;
   $95 = $88 - 32 | 0;
   $105 = $95 >> 31;
   $sr_1_ph = $88;
   $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
   $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
   $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
   $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
   break;
  }
  if ($rem | 0) {
   HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
   HEAP32[$rem + 4 >> 2] = 0;
  }
  if (($d_sroa_0_0_extract_trunc | 0) == 1) {
   $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
   $_0$0 = $a$0 | 0 | 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  } else {
   $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
   $_0$1 = $n_sroa_1_4_extract_trunc >>> ($78 >>> 0) | 0;
   $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
   return (tempRet0 = $_0$1, $_0$0) | 0;
  }
 } while (0);
 if (!$sr_1_ph) {
  $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
  $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
  $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
  $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
  $carry_0_lcssa$1 = 0;
  $carry_0_lcssa$0 = 0;
 } else {
  $d_sroa_0_0_insert_insert99$0 = $b$0 | 0 | 0;
  $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
  $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
  $137$1 = tempRet0;
  $q_sroa_1_1198 = $q_sroa_1_1_ph;
  $q_sroa_0_1199 = $q_sroa_0_1_ph;
  $r_sroa_1_1200 = $r_sroa_1_1_ph;
  $r_sroa_0_1201 = $r_sroa_0_1_ph;
  $sr_1202 = $sr_1_ph;
  $carry_0203 = 0;
  do {
   $q_sroa_1_1198$looptemp = $q_sroa_1_1198;
   $q_sroa_1_1198 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
   $q_sroa_0_1199 = $carry_0203 | $q_sroa_0_1199 << 1;
   $r_sroa_0_0_insert_insert42$0 = $r_sroa_0_1201 << 1 | $q_sroa_1_1198$looptemp >>> 31 | 0;
   $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
   _i64Subtract($137$0 | 0, $137$1 | 0, $r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0) | 0;
   $150$1 = tempRet0;
   $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1;
   $carry_0203 = $151$0 & 1;
   $r_sroa_0_1201 = _i64Subtract($r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0, $151$0 & $d_sroa_0_0_insert_insert99$0 | 0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1 | 0) | 0;
   $r_sroa_1_1200 = tempRet0;
   $sr_1202 = $sr_1202 - 1 | 0;
  } while (($sr_1202 | 0) != 0);
  $q_sroa_1_1_lcssa = $q_sroa_1_1198;
  $q_sroa_0_1_lcssa = $q_sroa_0_1199;
  $r_sroa_1_1_lcssa = $r_sroa_1_1200;
  $r_sroa_0_1_lcssa = $r_sroa_0_1201;
  $carry_0_lcssa$1 = 0;
  $carry_0_lcssa$0 = $carry_0203;
 }
 $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
 $q_sroa_0_0_insert_ext75$1 = 0;
 if ($rem | 0) {
  HEAP32[$rem >> 2] = $r_sroa_0_1_lcssa;
  HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa;
 }
 $_0$1 = ($q_sroa_0_0_insert_ext75$0 | 0) >>> 31 | ($q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1) << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
 $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
 return (tempRet0 = $_0$1, $_0$0) | 0;
}

function __Z11encodeImagejjRNSt3__26vectorIhNS_9allocatorIhEEEE($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0228 = 0, $$076224$us = 0, $$077225 = 0, $$078221$us = 0, $$pre = 0, $$pre233 = 0, $$sroa$0158$0210 = 0, $$sroa$0166$0211 = 0, $$sroa$0174$0215 = 0, $$sroa$0189$0217 = 0, $$sroa$0194$0 = 0, $100 = 0, $102 = 0, $103 = 0, $105 = 0, $106 = 0, $11 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $117 = 0, $119 = 0, $12 = 0, $121 = 0, $122 = 0, $123 = 0, $125 = 0, $126 = 0, $128 = 0, $129 = 0, $13 = 0, $135 = 0, $138 = 0, $139 = 0, $14 = 0, $141 = 0, $143 = 0, $144 = 0, $15 = 0, $152 = 0, $153 = 0, $17 = 0, $19 = 0, $21 = 0, $25 = 0, $26 = 0, $27 = 0, $3 = 0, $37 = 0, $39 = 0, $4 = 0, $41 = 0, $42 = 0, $43 = 0, $45 = 0, $46 = 0, $48 = 0, $49 = 0, $5 = 0, $55 = 0, $58 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $71 = 0, $72 = 0, $73 = 0, $75 = 0, $80 = 0, $81 = 0, $83 = 0, $84 = 0, $85 = 0, $87 = 0, $89 = 0, $90 = 0, $91 = 0, $93 = 0, $95 = 0, $96 = 0, $98 = 0, $99 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48 | 0;
 $3 = sp + 24 | 0;
 $4 = sp + 12 | 0;
 $5 = sp;
 $6 = sp + 36 | 0;
 if (!(($1 | 0) != 0 & ($1 + -1 & $1 | 0) == 0)) {
  $$sroa$0194$0 = 0;
  STACKTOP = sp;
  return $$sroa$0194$0 | 0;
 }
 __ZNSt3__26vectorINS0_INS0_IsNS_9allocatorIsEEEENS1_IS3_EEEENS1_IS5_EEEC2Ej($3, $0);
 $11 = ($0 | 0) == 0;
 $12 = $4 + 4 | 0;
 $$0228 = 0;
 do {
  __ZNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEEC2Ej($4, $0);
  $17 = Math_imul($$0228, $1) | 0;
  if (!$11) {
   $$076224$us = 0;
   do {
    $19 = Math_imul($$076224$us + $17 | 0, $0) | 0;
    $$078221$us = 0;
    do {
     $21 = HEAP32[$4 >> 2] | 0;
     $25 = HEAPU8[(HEAP32[$2 >> 2] | 0) + ($$078221$us + $19) >> 0] | 0;
     HEAP16[$5 >> 1] = $25;
     $26 = $21 + ($$078221$us * 12 | 0) + 4 | 0;
     $27 = HEAP32[$26 >> 2] | 0;
     if ($27 >>> 0 < (HEAP32[$21 + ($$078221$us * 12 | 0) + 8 >> 2] | 0) >>> 0) {
      HEAP16[$27 >> 1] = $25;
      HEAP32[$26 >> 2] = $27 + 2;
     } else __ZNSt3__26vectorIsNS_9allocatorIsEEE21__push_back_slow_pathIsEEvOT_($21 + ($$078221$us * 12 | 0) | 0, $5);
     $$078221$us = $$078221$us + 1 | 0;
    } while ($$078221$us >>> 0 < $0 >>> 0);
    $$076224$us = $$076224$us + 1 | 0;
   } while ($$076224$us >>> 0 < $1 >>> 0);
   if (!$11) {
    $$077225 = 0;
    do {
     $58 = HEAP32[$3 >> 2] | 0;
     $60 = (HEAP32[$4 >> 2] | 0) + ($$077225 * 12 | 0) | 0;
     $61 = $58 + ($$077225 * 12 | 0) + 4 | 0;
     $62 = HEAP32[$61 >> 2] | 0;
     if (($62 | 0) == (HEAP32[$58 + ($$077225 * 12 | 0) + 8 >> 2] | 0)) __ZNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEE21__push_back_slow_pathIRKS3_EEvOT_($58 + ($$077225 * 12 | 0) | 0, $60); else {
      __ZNSt3__26vectorIsNS_9allocatorIsEEEC2ERKS3_($62, $60);
      HEAP32[$61 >> 2] = (HEAP32[$61 >> 2] | 0) + 12;
     }
     $$077225 = $$077225 + 1 | 0;
    } while ($$077225 >>> 0 < $0 >>> 0);
   }
  }
  $37 = HEAP32[$4 >> 2] | 0;
  if ($37 | 0) {
   $39 = HEAP32[$12 >> 2] | 0;
   if (($39 | 0) == ($37 | 0)) $55 = $37; else {
    $42 = $39;
    while (1) {
     $41 = $42 + -12 | 0;
     HEAP32[$12 >> 2] = $41;
     $43 = HEAP32[$41 >> 2] | 0;
     $45 = $43;
     if (!$43) $46 = $41; else {
      $48 = $42 + -8 | 0;
      $49 = HEAP32[$48 >> 2] | 0;
      if (($49 | 0) != ($43 | 0)) HEAP32[$48 >> 2] = $49 + (~(($49 + -2 - $45 | 0) >>> 1) << 1);
      __ZdlPv($43);
      $46 = HEAP32[$12 >> 2] | 0;
     }
     if (($46 | 0) == ($37 | 0)) break; else $42 = $46;
    }
    $55 = HEAP32[$4 >> 2] | 0;
   }
   __ZdlPv($55);
  }
  $$0228 = $$0228 + 1 | 0;
 } while ($$0228 >>> 0 < $1 >>> 0);
 $13 = HEAP32[$3 >> 2] | 0;
 $14 = $3 + 4 | 0;
 $15 = HEAP32[$14 >> 2] | 0;
 if (($13 | 0) != ($15 | 0)) {
  $$sroa$0189$0217 = $13;
  do {
   __Z15haarTransform2DRNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEEE($$sroa$0189$0217) | 0;
   $$sroa$0189$0217 = $$sroa$0189$0217 + 12 | 0;
  } while (($$sroa$0189$0217 | 0) != ($15 | 0));
 }
 $71 = __Znwj(12) | 0;
 HEAP32[$71 >> 2] = 0;
 $72 = $71 + 4 | 0;
 HEAP32[$72 >> 2] = 0;
 $73 = $71 + 8 | 0;
 HEAP32[$73 >> 2] = 0;
 HEAP16[$4 >> 1] = $0;
 __ZNSt3__26vectorIsNS_9allocatorIsEEE21__push_back_slow_pathIsEEvOT_($71, $4);
 $$pre = HEAP32[$72 >> 2] | 0;
 $$pre233 = HEAP32[$73 >> 2] | 0;
 $75 = $1 & 65535;
 HEAP16[$4 >> 1] = $75;
 if ($$pre >>> 0 < $$pre233 >>> 0) {
  HEAP16[$$pre >> 1] = $75;
  HEAP32[$72 >> 2] = $$pre + 2;
 } else __ZNSt3__26vectorIsNS_9allocatorIsEEE21__push_back_slow_pathIsEEvOT_($71, $4);
 $80 = HEAP32[$3 >> 2] | 0;
 $81 = HEAP32[$14 >> 2] | 0;
 if (($80 | 0) == ($81 | 0)) $85 = $80; else {
  $83 = $4 + 4 | 0;
  $84 = $5 + 4 | 0;
  $$sroa$0174$0215 = $80;
  do {
   __ZNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEEC2ERKS5_($4, $$sroa$0174$0215);
   $114 = HEAP32[$4 >> 2] | 0;
   $115 = HEAP32[$83 >> 2] | 0;
   if (($114 | 0) == ($115 | 0)) $117 = $114; else {
    $$sroa$0166$0211 = $114;
    do {
     __ZNSt3__26vectorIsNS_9allocatorIsEEEC2ERKS3_($5, $$sroa$0166$0211);
     $138 = HEAP32[$5 >> 2] | 0;
     $139 = HEAP32[$84 >> 2] | 0;
     if (($138 | 0) == ($139 | 0)) $141 = $138; else {
      $$sroa$0158$0210 = $138;
      do {
       $152 = HEAP16[$$sroa$0158$0210 >> 1] | 0;
       HEAP16[$6 >> 1] = $152;
       $153 = HEAP32[$72 >> 2] | 0;
       if (($153 | 0) == (HEAP32[$73 >> 2] | 0)) __ZNSt3__26vectorIsNS_9allocatorIsEEE21__push_back_slow_pathIRKsEEvOT_($71, $6); else {
        HEAP16[$153 >> 1] = $152;
        HEAP32[$72 >> 2] = $153 + 2;
       }
       $$sroa$0158$0210 = $$sroa$0158$0210 + 2 | 0;
      } while (($$sroa$0158$0210 | 0) != ($139 | 0));
      $141 = HEAP32[$5 >> 2] | 0;
     }
     $143 = $141;
     if ($141 | 0) {
      $144 = HEAP32[$84 >> 2] | 0;
      if (($144 | 0) != ($141 | 0)) HEAP32[$84 >> 2] = $144 + (~(($144 + -2 - $143 | 0) >>> 1) << 1);
      __ZdlPv($141);
     }
     $$sroa$0166$0211 = $$sroa$0166$0211 + 12 | 0;
    } while (($$sroa$0166$0211 | 0) != ($115 | 0));
    $117 = HEAP32[$4 >> 2] | 0;
   }
   if ($117 | 0) {
    $119 = HEAP32[$83 >> 2] | 0;
    if (($119 | 0) == ($117 | 0)) $135 = $117; else {
     $122 = $119;
     while (1) {
      $121 = $122 + -12 | 0;
      HEAP32[$83 >> 2] = $121;
      $123 = HEAP32[$121 >> 2] | 0;
      $125 = $123;
      if (!$123) $126 = $121; else {
       $128 = $122 + -8 | 0;
       $129 = HEAP32[$128 >> 2] | 0;
       if (($129 | 0) != ($123 | 0)) HEAP32[$128 >> 2] = $129 + (~(($129 + -2 - $125 | 0) >>> 1) << 1);
       __ZdlPv($123);
       $126 = HEAP32[$83 >> 2] | 0;
      }
      if (($126 | 0) == ($117 | 0)) break; else $122 = $126;
     }
     $135 = HEAP32[$4 >> 2] | 0;
    }
    __ZdlPv($135);
   }
   $$sroa$0174$0215 = $$sroa$0174$0215 + 12 | 0;
  } while (($$sroa$0174$0215 | 0) != ($81 | 0));
  $85 = HEAP32[$3 >> 2] | 0;
 }
 if ($85 | 0) {
  $87 = HEAP32[$14 >> 2] | 0;
  if (($87 | 0) == ($85 | 0)) $113 = $85; else {
   $90 = $87;
   while (1) {
    $89 = $90 + -12 | 0;
    HEAP32[$14 >> 2] = $89;
    $91 = HEAP32[$89 >> 2] | 0;
    if (!$91) $93 = $89; else {
     $95 = $90 + -8 | 0;
     $96 = HEAP32[$95 >> 2] | 0;
     if (($96 | 0) == ($91 | 0)) $112 = $91; else {
      $99 = $96;
      while (1) {
       $98 = $99 + -12 | 0;
       HEAP32[$95 >> 2] = $98;
       $100 = HEAP32[$98 >> 2] | 0;
       $102 = $100;
       if (!$100) $103 = $98; else {
        $105 = $99 + -8 | 0;
        $106 = HEAP32[$105 >> 2] | 0;
        if (($106 | 0) != ($100 | 0)) HEAP32[$105 >> 2] = $106 + (~(($106 + -2 - $102 | 0) >>> 1) << 1);
        __ZdlPv($100);
        $103 = HEAP32[$95 >> 2] | 0;
       }
       if (($103 | 0) == ($91 | 0)) break; else $99 = $103;
      }
      $112 = HEAP32[$89 >> 2] | 0;
     }
     __ZdlPv($112);
     $93 = HEAP32[$14 >> 2] | 0;
    }
    if (($93 | 0) == ($85 | 0)) break; else $90 = $93;
   }
   $113 = HEAP32[$3 >> 2] | 0;
  }
  __ZdlPv($113);
 }
 $$sroa$0194$0 = $71;
 STACKTOP = sp;
 return $$sroa$0194$0 | 0;
}

function __Z11decodeImageNSt3__210unique_ptrINS_6vectorIsNS_9allocatorIsEEEENS_14default_deleteIS4_EEEEPjS8_($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0$i$i = 0, $$0$i$i$i$us = 0, $$0$off0$us = 0, $$087187$us = 0, $$093188$us = 0, $$094199 = 0, $$095196 = 0, $$pre$phi203Z2D = 0, $$sroa$0169$0192 = 0, $10 = 0, $104 = 0, $105 = 0, $107 = 0, $109 = 0, $111 = 0, $113 = 0, $114 = 0, $116 = 0, $118 = 0, $12 = 0, $121 = 0, $122 = 0, $128 = 0, $13 = 0, $14 = 0, $140 = 0, $142 = 0, $144 = 0, $145 = 0, $146 = 0, $148 = 0, $15 = 0, $150 = 0, $151 = 0, $153 = 0, $154 = 0, $155 = 0, $157 = 0, $158 = 0, $16 = 0, $160 = 0, $161 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $172 = 0, $173 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $28 = 0, $3 = 0, $30 = 0, $35 = 0, $37 = 0, $38 = 0, $4 = 0, $45 = 0, $46 = 0, $47 = 0, $49 = 0, $5 = 0, $6 = 0, $63 = 0, $65 = 0, $67 = 0, $68 = 0, $69 = 0, $71 = 0, $72 = 0, $74 = 0, $75 = 0, $8 = 0, $81 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $9 = 0, $91 = 0, $92 = 0, $99 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48 | 0;
 $3 = sp + 36 | 0;
 $4 = sp + 24 | 0;
 $5 = sp + 12 | 0;
 $6 = sp;
 __ZNSt3__26vectorIsNS_9allocatorIsEEEC2ERKS3_($3, HEAP32[$0 >> 2] | 0);
 $8 = HEAP32[$3 >> 2] | 0;
 $9 = HEAP16[$8 >> 1] | 0;
 $10 = $9 << 16 >> 16;
 $12 = HEAP16[$8 + 2 >> 1] | 0;
 $13 = $12 << 16 >> 16;
 __ZNSt3__26vectorINS0_INS0_IsNS_9allocatorIsEEEENS1_IS3_EEEENS1_IS5_EEEC2Ej($4, $10);
 $14 = $9 << 16 >> 16 > 0;
 L1 : do if ($14) {
  $15 = $5 + 4 | 0;
  $16 = $5 + 8 | 0;
  $17 = $12 << 16 >> 16 == 0;
  $18 = Math_imul($13, $13) | 0;
  $19 = ($18 | 0) == 0;
  $20 = $6 + 4 | 0;
  $21 = $12 << 16 >> 16 < 0;
  $22 = $13 * 12 | 0;
  $23 = $5 + 8 | 0;
  $$094199 = 0;
  while (1) {
   __ZNSt3__26vectorIsNS_9allocatorIsEEEC2Ej($6, $13);
   HEAP32[$5 >> 2] = 0;
   HEAP32[$15 >> 2] = 0;
   HEAP32[$16 >> 2] = 0;
   if (!$17) {
    if ($21) break;
    $28 = __Znwj($22) | 0;
    HEAP32[$15 >> 2] = $28;
    HEAP32[$5 >> 2] = $28;
    HEAP32[$23 >> 2] = $28 + ($13 * 12 | 0);
    $$0$i$i = $13;
    $30 = $28;
    do {
     __ZNSt3__26vectorIsNS_9allocatorIsEEEC2ERKS3_($30, $6);
     $30 = (HEAP32[$15 >> 2] | 0) + 12 | 0;
     HEAP32[$15 >> 2] = $30;
     $$0$i$i = $$0$i$i + -1 | 0;
    } while (($$0$i$i | 0) != 0);
   }
   $35 = HEAP32[$6 >> 2] | 0;
   $37 = $35;
   if ($35 | 0) {
    $38 = HEAP32[$20 >> 2] | 0;
    if (($38 | 0) != ($35 | 0)) HEAP32[$20 >> 2] = $38 + (~(($38 + -2 - $37 | 0) >>> 1) << 1);
    __ZdlPv($35);
   }
   if (!$19) {
    $45 = (Math_imul($18, $$094199) | 0) + 2 | 0;
    $46 = HEAP32[$3 >> 2] | 0;
    $47 = HEAP32[$5 >> 2] | 0;
    $$095196 = 0;
    do {
     HEAP16[(HEAP32[$47 + ((($$095196 | 0) / ($13 | 0) | 0) * 12 | 0) >> 2] | 0) + ((($$095196 | 0) % ($13 | 0) | 0) << 1) >> 1] = HEAP16[$46 + ($45 + $$095196 << 1) >> 1] | 0;
     $$095196 = $$095196 + 1 | 0;
    } while (($$095196 | 0) < ($18 | 0));
   }
   $49 = (HEAP32[$4 >> 2] | 0) + ($$094199 * 12 | 0) | 0;
   if (($49 | 0) != ($5 | 0)) __ZNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEE6assignIPS3_EENS_9enable_ifIXaasr21__is_forward_iteratorIT_EE5valuesr16is_constructibleIS3_NS_15iterator_traitsIS9_E9referenceEEE5valueEvE4typeES9_S9_($49, HEAP32[$5 >> 2] | 0, HEAP32[$15 >> 2] | 0);
   $63 = HEAP32[$5 >> 2] | 0;
   if ($63 | 0) {
    $65 = HEAP32[$15 >> 2] | 0;
    if (($65 | 0) == ($63 | 0)) $81 = $63; else {
     $68 = $65;
     while (1) {
      $67 = $68 + -12 | 0;
      HEAP32[$15 >> 2] = $67;
      $69 = HEAP32[$67 >> 2] | 0;
      $71 = $69;
      if (!$69) $72 = $67; else {
       $74 = $68 + -8 | 0;
       $75 = HEAP32[$74 >> 2] | 0;
       if (($75 | 0) != ($69 | 0)) HEAP32[$74 >> 2] = $75 + (~(($75 + -2 - $71 | 0) >>> 1) << 1);
       __ZdlPv($69);
       $72 = HEAP32[$15 >> 2] | 0;
      }
      if (($72 | 0) == ($63 | 0)) break; else $68 = $72;
     }
     $81 = HEAP32[$5 >> 2] | 0;
    }
    __ZdlPv($81);
   }
   $$094199 = $$094199 + 1 | 0;
   if (($$094199 | 0) >= ($10 | 0)) {
    $$pre$phi203Z2D = $4;
    break L1;
   }
  }
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($5);
 } else $$pre$phi203Z2D = $4; while (0);
 $24 = HEAP32[$$pre$phi203Z2D >> 2] | 0;
 $25 = $4 + 4 | 0;
 $26 = HEAP32[$25 >> 2] | 0;
 if (($24 | 0) != ($26 | 0)) {
  $$sroa$0169$0192 = $24;
  do {
   __Z16ihaarTransform2DRNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEEE($$sroa$0169$0192) | 0;
   $$sroa$0169$0192 = $$sroa$0169$0192 + 12 | 0;
  } while (($$sroa$0169$0192 | 0) != ($26 | 0));
 }
 $84 = __Znwj(12) | 0;
 HEAP32[$84 >> 2] = 0;
 $85 = $84 + 4 | 0;
 HEAP32[$85 >> 2] = 0;
 $86 = $84 + 8 | 0;
 HEAP32[$86 >> 2] = 0;
 $87 = Math_imul($13, $13) | 0;
 L46 : do if ($87 | 0) if ($14) {
  $$093188$us = 0;
  L48 : while (1) {
   $91 = ($$093188$us | 0) / ($13 | 0) | 0;
   $92 = ($$093188$us | 0) % ($13 | 0) | 0;
   $$087187$us = 0;
   do {
    $99 = HEAP16[(HEAP32[(HEAP32[(HEAP32[$$pre$phi203Z2D >> 2] | 0) + ($$087187$us * 12 | 0) >> 2] | 0) + ($91 * 12 | 0) >> 2] | 0) + ($92 << 1) >> 1] | 0;
    if ($99 << 16 >> 16 > 255) $$0$off0$us = -1; else $$0$off0$us = ($99 << 16 >> 16 > 0 ? $99 : 0) & 255;
    $104 = HEAP32[$85 >> 2] | 0;
    $105 = HEAP32[$86 >> 2] | 0;
    $107 = $104;
    if ($104 >>> 0 < $105 >>> 0) {
     HEAP8[$104 >> 0] = $$0$off0$us;
     HEAP32[$85 >> 2] = (HEAP32[$85 >> 2] | 0) + 1;
    } else {
     $109 = HEAP32[$84 >> 2] | 0;
     $111 = $107 - $109 + 1 | 0;
     if (($111 | 0) < 0) break L48;
     $113 = $109;
     $114 = $105 - $109 | 0;
     $116 = $114 << 1;
     $$0$i$i$i$us = $114 >>> 0 < 1073741823 ? ($116 >>> 0 < $111 >>> 0 ? $111 : $116) : 2147483647;
     $118 = $107 - $109 | 0;
     if (!$$0$i$i$i$us) $122 = 0; else $122 = __Znwj($$0$i$i$i$us) | 0;
     $121 = $122 + $118 | 0;
     HEAP8[$121 >> 0] = $$0$off0$us;
     $128 = $121 + (0 - $118) | 0;
     if (($118 | 0) > 0) _memcpy($128 | 0, $113 | 0, $118 | 0) | 0;
     HEAP32[$84 >> 2] = $128;
     HEAP32[$85 >> 2] = $121 + 1;
     HEAP32[$86 >> 2] = $122 + $$0$i$i$i$us;
     if ($109 | 0) __ZdlPv($113);
    }
    $$087187$us = $$087187$us + 1 | 0;
   } while (($$087187$us | 0) < ($10 | 0));
   $$093188$us = $$093188$us + 1 | 0;
   if (($$093188$us | 0) >= ($87 | 0)) break L46;
  }
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($84);
 } while (0);
 if ($1 | 0) HEAP32[$1 >> 2] = $10;
 if ($2 | 0) HEAP32[$2 >> 2] = $13;
 $140 = HEAP32[$$pre$phi203Z2D >> 2] | 0;
 if ($140 | 0) {
  $142 = HEAP32[$25 >> 2] | 0;
  if (($142 | 0) == ($140 | 0)) $168 = $140; else {
   $145 = $142;
   while (1) {
    $144 = $145 + -12 | 0;
    HEAP32[$25 >> 2] = $144;
    $146 = HEAP32[$144 >> 2] | 0;
    if (!$146) $148 = $144; else {
     $150 = $145 + -8 | 0;
     $151 = HEAP32[$150 >> 2] | 0;
     if (($151 | 0) == ($146 | 0)) $167 = $146; else {
      $154 = $151;
      while (1) {
       $153 = $154 + -12 | 0;
       HEAP32[$150 >> 2] = $153;
       $155 = HEAP32[$153 >> 2] | 0;
       $157 = $155;
       if (!$155) $158 = $153; else {
        $160 = $154 + -8 | 0;
        $161 = HEAP32[$160 >> 2] | 0;
        if (($161 | 0) != ($155 | 0)) HEAP32[$160 >> 2] = $161 + (~(($161 + -2 - $157 | 0) >>> 1) << 1);
        __ZdlPv($155);
        $158 = HEAP32[$150 >> 2] | 0;
       }
       if (($158 | 0) == ($146 | 0)) break; else $154 = $158;
      }
      $167 = HEAP32[$144 >> 2] | 0;
     }
     __ZdlPv($167);
     $148 = HEAP32[$25 >> 2] | 0;
    }
    if (($148 | 0) == ($140 | 0)) break; else $145 = $148;
   }
   $168 = HEAP32[$4 >> 2] | 0;
  }
  __ZdlPv($168);
 }
 $169 = HEAP32[$3 >> 2] | 0;
 if (!$169) {
  STACKTOP = sp;
  return $84 | 0;
 }
 $172 = $3 + 4 | 0;
 $173 = HEAP32[$172 >> 2] | 0;
 if (($173 | 0) != ($169 | 0)) HEAP32[$172 >> 2] = $173 + (~(($173 + -2 - $169 | 0) >>> 1) << 1);
 __ZdlPv($169);
 STACKTOP = sp;
 return $84 | 0;
}

function _compress_block($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0 = 0, $$phi$trans$insert = 0, $$phi$trans$insert204 = 0, $$pre$phi206Z2D = 0, $$pre$phiZ2D = 0, $10 = 0, $103 = 0, $106 = 0, $107 = 0, $108 = 0, $11 = 0, $110 = 0, $116 = 0, $117 = 0, $121 = 0, $124 = 0, $128 = 0, $132 = 0, $135 = 0, $137 = 0, $14 = 0, $141 = 0, $144 = 0, $145 = 0, $146 = 0, $148 = 0, $15 = 0, $154 = 0, $155 = 0, $159 = 0, $162 = 0, $166 = 0, $168 = 0, $176 = 0, $179 = 0, $180 = 0, $181 = 0, $183 = 0, $189 = 0, $190 = 0, $194 = 0, $197 = 0, $20 = 0, $205 = 0, $207 = 0, $211 = 0, $214 = 0, $215 = 0, $218 = 0, $219 = 0, $221 = 0, $226 = 0, $227 = 0, $231 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $25 = 0, $3 = 0, $30 = 0, $34 = 0, $35 = 0, $37 = 0, $43 = 0, $44 = 0, $48 = 0, $51 = 0, $57 = 0, $59 = 0, $6 = 0, $62 = 0, $63 = 0, $68 = 0, $7 = 0, $72 = 0, $73 = 0, $75 = 0, $8 = 0, $81 = 0, $82 = 0, $86 = 0, $89 = 0, $9 = 0, $93 = 0, $95 = 0, $storemerge = 0, $storemerge201 = 0, $storemerge202 = 0, $storemerge203 = 0;
 $3 = $0 + 5792 | 0;
 if (!(HEAP32[$3 >> 2] | 0)) {
  $$phi$trans$insert = $0 + 5820 | 0;
  $$phi$trans$insert204 = $0 + 5816 | 0;
  $$pre$phi206Z2D = $$phi$trans$insert204;
  $$pre$phiZ2D = $$phi$trans$insert;
  $207 = HEAP32[$$phi$trans$insert >> 2] | 0;
  $214 = HEAP16[$$phi$trans$insert204 >> 1] | 0;
 } else {
  $6 = $0 + 5796 | 0;
  $7 = $0 + 5784 | 0;
  $8 = $0 + 5820 | 0;
  $9 = $0 + 5816 | 0;
  $10 = $0 + 20 | 0;
  $11 = $0 + 8 | 0;
  $$0 = 0;
  do {
   $14 = HEAP16[(HEAP32[$6 >> 2] | 0) + ($$0 << 1) >> 1] | 0;
   $15 = $14 & 65535;
   $20 = HEAPU8[(HEAP32[$7 >> 2] | 0) + $$0 >> 0] | 0;
   $$0 = $$0 + 1 | 0;
   if (!($14 << 16 >> 16)) {
    $24 = HEAPU16[$1 + ($20 << 2) + 2 >> 1] | 0;
    $25 = HEAP32[$8 >> 2] | 0;
    $30 = HEAPU16[$1 + ($20 << 2) >> 1] | 0;
    $34 = HEAPU16[$9 >> 1] | 0 | $30 << $25;
    $35 = $34 & 65535;
    HEAP16[$9 >> 1] = $35;
    if (($25 | 0) > (16 - $24 | 0)) {
     $37 = HEAP32[$10 >> 2] | 0;
     HEAP32[$10 >> 2] = $37 + 1;
     HEAP8[(HEAP32[$11 >> 2] | 0) + $37 >> 0] = $34;
     $43 = (HEAPU16[$9 >> 1] | 0) >>> 8 & 255;
     $44 = HEAP32[$10 >> 2] | 0;
     HEAP32[$10 >> 2] = $44 + 1;
     HEAP8[(HEAP32[$11 >> 2] | 0) + $44 >> 0] = $43;
     $48 = HEAP32[$8 >> 2] | 0;
     $51 = $30 >>> (16 - $48 | 0) & 65535;
     HEAP16[$9 >> 1] = $51;
     $238 = $51;
     $storemerge203 = $24 + -16 + $48 | 0;
    } else {
     $238 = $35;
     $storemerge203 = $25 + $24 | 0;
    }
    HEAP32[$8 >> 2] = $storemerge203;
    $239 = $238;
    $240 = $storemerge203;
   } else {
    $57 = HEAPU8[13012 + $20 >> 0] | 0;
    $59 = ($57 | 256) + 1 | 0;
    $62 = HEAPU16[$1 + ($59 << 2) + 2 >> 1] | 0;
    $63 = HEAP32[$8 >> 2] | 0;
    $68 = HEAPU16[$1 + ($59 << 2) >> 1] | 0;
    $72 = HEAPU16[$9 >> 1] | 0 | $68 << $63;
    $73 = $72 & 65535;
    HEAP16[$9 >> 1] = $73;
    if (($63 | 0) > (16 - $62 | 0)) {
     $75 = HEAP32[$10 >> 2] | 0;
     HEAP32[$10 >> 2] = $75 + 1;
     HEAP8[(HEAP32[$11 >> 2] | 0) + $75 >> 0] = $72;
     $81 = (HEAPU16[$9 >> 1] | 0) >>> 8 & 255;
     $82 = HEAP32[$10 >> 2] | 0;
     HEAP32[$10 >> 2] = $82 + 1;
     HEAP8[(HEAP32[$11 >> 2] | 0) + $82 >> 0] = $81;
     $86 = HEAP32[$8 >> 2] | 0;
     $89 = $68 >>> (16 - $86 | 0) & 65535;
     HEAP16[$9 >> 1] = $89;
     $106 = $89;
     $93 = $62 + -16 + $86 | 0;
    } else {
     $106 = $73;
     $93 = $63 + $62 | 0;
    }
    HEAP32[$8 >> 2] = $93;
    $95 = HEAP32[1208 + ($57 << 2) >> 2] | 0;
    if (($57 + -8 | 0) >>> 0 < 20) {
     $103 = $20 - (HEAP32[1324 + ($57 << 2) >> 2] | 0) & 65535;
     $107 = $103 << $93 | $106 & 65535;
     $108 = $107 & 65535;
     HEAP16[$9 >> 1] = $108;
     if (($93 | 0) > (16 - $95 | 0)) {
      $110 = HEAP32[$10 >> 2] | 0;
      HEAP32[$10 >> 2] = $110 + 1;
      HEAP8[(HEAP32[$11 >> 2] | 0) + $110 >> 0] = $107;
      $116 = (HEAPU16[$9 >> 1] | 0) >>> 8 & 255;
      $117 = HEAP32[$10 >> 2] | 0;
      HEAP32[$10 >> 2] = $117 + 1;
      HEAP8[(HEAP32[$11 >> 2] | 0) + $117 >> 0] = $116;
      $121 = HEAP32[$8 >> 2] | 0;
      $124 = $103 >>> (16 - $121 | 0) & 65535;
      HEAP16[$9 >> 1] = $124;
      $241 = $124;
      $storemerge202 = $95 + -16 + $121 | 0;
     } else {
      $241 = $108;
      $storemerge202 = $93 + $95 | 0;
     }
     HEAP32[$8 >> 2] = $storemerge202;
     $137 = $storemerge202;
     $144 = $241;
    } else {
     $137 = $93;
     $144 = $106;
    }
    $128 = $15 + -1 | 0;
    $132 = HEAPU8[12500 + ($128 >>> 0 < 256 ? $128 : ($128 >>> 7) + 256 | 0) >> 0] | 0;
    $135 = HEAPU16[$2 + ($132 << 2) + 2 >> 1] | 0;
    $141 = HEAPU16[$2 + ($132 << 2) >> 1] | 0;
    $145 = $144 & 65535 | $141 << $137;
    $146 = $145 & 65535;
    HEAP16[$9 >> 1] = $146;
    if (($137 | 0) > (16 - $135 | 0)) {
     $148 = HEAP32[$10 >> 2] | 0;
     HEAP32[$10 >> 2] = $148 + 1;
     HEAP8[(HEAP32[$11 >> 2] | 0) + $148 >> 0] = $145;
     $154 = (HEAPU16[$9 >> 1] | 0) >>> 8 & 255;
     $155 = HEAP32[$10 >> 2] | 0;
     HEAP32[$10 >> 2] = $155 + 1;
     HEAP8[(HEAP32[$11 >> 2] | 0) + $155 >> 0] = $154;
     $159 = HEAP32[$8 >> 2] | 0;
     $162 = $141 >>> (16 - $159 | 0) & 65535;
     HEAP16[$9 >> 1] = $162;
     $166 = $135 + -16 + $159 | 0;
     $179 = $162;
    } else {
     $166 = $137 + $135 | 0;
     $179 = $146;
    }
    HEAP32[$8 >> 2] = $166;
    $168 = HEAP32[1088 + ($132 << 2) >> 2] | 0;
    if (($132 + -4 | 0) >>> 0 < 26) {
     $176 = $128 - (HEAP32[1440 + ($132 << 2) >> 2] | 0) & 65535;
     $180 = $176 << $166 | $179 & 65535;
     $181 = $180 & 65535;
     HEAP16[$9 >> 1] = $181;
     if (($166 | 0) > (16 - $168 | 0)) {
      $183 = HEAP32[$10 >> 2] | 0;
      HEAP32[$10 >> 2] = $183 + 1;
      HEAP8[(HEAP32[$11 >> 2] | 0) + $183 >> 0] = $180;
      $189 = (HEAPU16[$9 >> 1] | 0) >>> 8 & 255;
      $190 = HEAP32[$10 >> 2] | 0;
      HEAP32[$10 >> 2] = $190 + 1;
      HEAP8[(HEAP32[$11 >> 2] | 0) + $190 >> 0] = $189;
      $194 = HEAP32[$8 >> 2] | 0;
      $197 = $176 >>> (16 - $194 | 0) & 65535;
      HEAP16[$9 >> 1] = $197;
      $242 = $197;
      $storemerge201 = $168 + -16 + $194 | 0;
     } else {
      $242 = $181;
      $storemerge201 = $166 + $168 | 0;
     }
     HEAP32[$8 >> 2] = $storemerge201;
     $239 = $242;
     $240 = $storemerge201;
    } else {
     $239 = $179;
     $240 = $166;
    }
   }
  } while ($$0 >>> 0 < (HEAP32[$3 >> 2] | 0) >>> 0);
  $$pre$phi206Z2D = $9;
  $$pre$phiZ2D = $8;
  $207 = $240;
  $214 = $239;
 }
 $205 = HEAPU16[$1 + 1026 >> 1] | 0;
 $211 = HEAPU16[$1 + 1024 >> 1] | 0;
 $215 = $214 & 65535 | $211 << $207;
 HEAP16[$$pre$phi206Z2D >> 1] = $215;
 if (($207 | 0) > (16 - $205 | 0)) {
  $218 = $0 + 20 | 0;
  $219 = HEAP32[$218 >> 2] | 0;
  HEAP32[$218 >> 2] = $219 + 1;
  $221 = $0 + 8 | 0;
  HEAP8[(HEAP32[$221 >> 2] | 0) + $219 >> 0] = $215;
  $226 = (HEAPU16[$$pre$phi206Z2D >> 1] | 0) >>> 8 & 255;
  $227 = HEAP32[$218 >> 2] | 0;
  HEAP32[$218 >> 2] = $227 + 1;
  HEAP8[(HEAP32[$221 >> 2] | 0) + $227 >> 0] = $226;
  $231 = HEAP32[$$pre$phiZ2D >> 2] | 0;
  HEAP16[$$pre$phi206Z2D >> 1] = $211 >>> (16 - $231 | 0);
  $storemerge = $205 + -16 + $231 | 0;
  HEAP32[$$pre$phiZ2D >> 2] = $storemerge;
  return;
 } else {
  $storemerge = $207 + $205 | 0;
  HEAP32[$$pre$phiZ2D >> 2] = $storemerge;
  return;
 }
}

function _adler32_z($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$ = 0, $$0 = 0, $$0174198 = 0, $$0178197 = 0, $$0190 = 0, $$1$lcssa = 0, $$1175$lcssa245248 = 0, $$1175220 = 0, $$1179$lcssa244249 = 0, $$1179219 = 0, $$1184$lcssa = 0, $$1184196 = 0, $$1199 = 0, $$2$lcssa246247 = 0, $$2176211 = 0, $$2180 = 0, $$2221 = 0, $$3 = 0, $$3177203 = 0, $$3181210 = 0, $$3186$lcssa243250 = 0, $$3186218 = 0, $$4182202 = 0, $$4187 = 0, $$4212 = 0, $$5$lcssa = 0, $$5188209 = 0, $$5204 = 0, $$6 = 0, $$6189$lcssa = 0, $$6189201 = 0, $$7 = 0, $100 = 0, $105 = 0, $11 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $128 = 0, $133 = 0, $138 = 0, $143 = 0, $148 = 0, $153 = 0, $158 = 0, $163 = 0, $168 = 0, $173 = 0, $178 = 0, $183 = 0, $188 = 0, $193 = 0, $198 = 0, $211 = 0, $212 = 0, $24 = 0, $25 = 0, $3 = 0, $35 = 0, $4 = 0, $40 = 0, $45 = 0, $50 = 0, $55 = 0, $60 = 0, $65 = 0, $70 = 0, $75 = 0, $8 = 0, $80 = 0, $85 = 0, $90 = 0, $95 = 0, label = 0;
 $3 = $0 >>> 16;
 $4 = $0 & 65535;
 if (($2 | 0) == 1) {
  $8 = (HEAPU8[$1 >> 0] | 0) + $4 | 0;
  $$ = $8 >>> 0 > 65520 ? $8 + -65521 | 0 : $8;
  $11 = $$ + $3 | 0;
  $$0190 = ($11 >>> 0 > 65520 ? $11 + 15 | 0 : $11) << 16 | $$;
  return $$0190 | 0;
 }
 if (!$1) {
  $$0190 = 1;
  return $$0190 | 0;
 }
 if ($2 >>> 0 < 16) {
  if (!$2) {
   $$1$lcssa = $3;
   $$1184$lcssa = $4;
  } else {
   $$0174198 = $2;
   $$0178197 = $1;
   $$1184196 = $4;
   $$1199 = $3;
   while (1) {
    $$0174198 = $$0174198 + -1 | 0;
    $24 = (HEAPU8[$$0178197 >> 0] | 0) + $$1184196 | 0;
    $25 = $24 + $$1199 | 0;
    if (!$$0174198) {
     $$1$lcssa = $25;
     $$1184$lcssa = $24;
     break;
    } else {
     $$0178197 = $$0178197 + 1 | 0;
     $$1184196 = $24;
     $$1199 = $25;
    }
   }
  }
  $$0190 = (($$1$lcssa >>> 0) % 65521 | 0) << 16 | ($$1184$lcssa >>> 0 > 65520 ? $$1184$lcssa + -65521 | 0 : $$1184$lcssa);
  return $$0190 | 0;
 }
 if ($2 >>> 0 > 5551) {
  $$1175220 = $2;
  $$1179219 = $1;
  $$2221 = $3;
  $$3186218 = $4;
  do {
   $$1175220 = $$1175220 + -5552 | 0;
   $$0 = 347;
   $$2180 = $$1179219;
   $$3 = $$2221;
   $$4187 = $$3186218;
   while (1) {
    $35 = (HEAPU8[$$2180 >> 0] | 0) + $$4187 | 0;
    $40 = $35 + (HEAPU8[$$2180 + 1 >> 0] | 0) | 0;
    $45 = $40 + (HEAPU8[$$2180 + 2 >> 0] | 0) | 0;
    $50 = $45 + (HEAPU8[$$2180 + 3 >> 0] | 0) | 0;
    $55 = $50 + (HEAPU8[$$2180 + 4 >> 0] | 0) | 0;
    $60 = $55 + (HEAPU8[$$2180 + 5 >> 0] | 0) | 0;
    $65 = $60 + (HEAPU8[$$2180 + 6 >> 0] | 0) | 0;
    $70 = $65 + (HEAPU8[$$2180 + 7 >> 0] | 0) | 0;
    $75 = $70 + (HEAPU8[$$2180 + 8 >> 0] | 0) | 0;
    $80 = $75 + (HEAPU8[$$2180 + 9 >> 0] | 0) | 0;
    $85 = $80 + (HEAPU8[$$2180 + 10 >> 0] | 0) | 0;
    $90 = $85 + (HEAPU8[$$2180 + 11 >> 0] | 0) | 0;
    $95 = $90 + (HEAPU8[$$2180 + 12 >> 0] | 0) | 0;
    $100 = $95 + (HEAPU8[$$2180 + 13 >> 0] | 0) | 0;
    $105 = $100 + (HEAPU8[$$2180 + 14 >> 0] | 0) | 0;
    $$4187 = $105 + (HEAPU8[$$2180 + 15 >> 0] | 0) | 0;
    $$3 = $35 + $$3 + $40 + $45 + $50 + $55 + $60 + $65 + $70 + $75 + $80 + $85 + $90 + $95 + $100 + $105 + $$4187 | 0;
    $$0 = $$0 + -1 | 0;
    if (!$$0) break; else $$2180 = $$2180 + 16 | 0;
   }
   $$1179219 = $$1179219 + 5552 | 0;
   $$3186218 = ($$4187 >>> 0) % 65521 | 0;
   $$2221 = ($$3 >>> 0) % 65521 | 0;
  } while ($$1175220 >>> 0 > 5551);
  if (!$$1175220) {
   $$6 = $$2221;
   $$7 = $$3186218;
  } else if ($$1175220 >>> 0 > 15) {
   $$1175$lcssa245248 = $$1175220;
   $$1179$lcssa244249 = $$1179219;
   $$2$lcssa246247 = $$2221;
   $$3186$lcssa243250 = $$3186218;
   label = 14;
  } else {
   $$3177203 = $$1175220;
   $$4182202 = $$1179219;
   $$5204 = $$2221;
   $$6189201 = $$3186218;
   label = 17;
  }
 } else {
  $$1175$lcssa245248 = $2;
  $$1179$lcssa244249 = $1;
  $$2$lcssa246247 = $3;
  $$3186$lcssa243250 = $4;
  label = 14;
 }
 if ((label | 0) == 14) {
  $120 = $$1175$lcssa245248 + -16 | 0;
  $121 = $120 & -16;
  $122 = $121 + 16 | 0;
  $$2176211 = $$1175$lcssa245248;
  $$3181210 = $$1179$lcssa244249;
  $$4212 = $$2$lcssa246247;
  $$5188209 = $$3186$lcssa243250;
  while (1) {
   $$2176211 = $$2176211 + -16 | 0;
   $128 = (HEAPU8[$$3181210 >> 0] | 0) + $$5188209 | 0;
   $133 = $128 + (HEAPU8[$$3181210 + 1 >> 0] | 0) | 0;
   $138 = $133 + (HEAPU8[$$3181210 + 2 >> 0] | 0) | 0;
   $143 = $138 + (HEAPU8[$$3181210 + 3 >> 0] | 0) | 0;
   $148 = $143 + (HEAPU8[$$3181210 + 4 >> 0] | 0) | 0;
   $153 = $148 + (HEAPU8[$$3181210 + 5 >> 0] | 0) | 0;
   $158 = $153 + (HEAPU8[$$3181210 + 6 >> 0] | 0) | 0;
   $163 = $158 + (HEAPU8[$$3181210 + 7 >> 0] | 0) | 0;
   $168 = $163 + (HEAPU8[$$3181210 + 8 >> 0] | 0) | 0;
   $173 = $168 + (HEAPU8[$$3181210 + 9 >> 0] | 0) | 0;
   $178 = $173 + (HEAPU8[$$3181210 + 10 >> 0] | 0) | 0;
   $183 = $178 + (HEAPU8[$$3181210 + 11 >> 0] | 0) | 0;
   $188 = $183 + (HEAPU8[$$3181210 + 12 >> 0] | 0) | 0;
   $193 = $188 + (HEAPU8[$$3181210 + 13 >> 0] | 0) | 0;
   $198 = $193 + (HEAPU8[$$3181210 + 14 >> 0] | 0) | 0;
   $$5188209 = $198 + (HEAPU8[$$3181210 + 15 >> 0] | 0) | 0;
   $$4212 = $128 + $$4212 + $133 + $138 + $143 + $148 + $153 + $158 + $163 + $168 + $173 + $178 + $183 + $188 + $193 + $198 + $$5188209 | 0;
   if ($$2176211 >>> 0 <= 15) break; else $$3181210 = $$3181210 + 16 | 0;
  }
  $123 = $120 - $121 | 0;
  if (!$123) {
   $$5$lcssa = $$4212;
   $$6189$lcssa = $$5188209;
   label = 18;
  } else {
   $$3177203 = $123;
   $$4182202 = $$1179$lcssa244249 + $122 | 0;
   $$5204 = $$4212;
   $$6189201 = $$5188209;
   label = 17;
  }
 }
 if ((label | 0) == 17) while (1) {
  label = 0;
  $$3177203 = $$3177203 + -1 | 0;
  $211 = (HEAPU8[$$4182202 >> 0] | 0) + $$6189201 | 0;
  $212 = $211 + $$5204 | 0;
  if (!$$3177203) {
   $$5$lcssa = $212;
   $$6189$lcssa = $211;
   label = 18;
   break;
  } else {
   $$4182202 = $$4182202 + 1 | 0;
   $$5204 = $212;
   $$6189201 = $211;
   label = 17;
  }
 }
 if ((label | 0) == 18) {
  $$6 = ($$5$lcssa >>> 0) % 65521 | 0;
  $$7 = ($$6189$lcssa >>> 0) % 65521 | 0;
 }
 $$0190 = $$6 << 16 | $$7;
 return $$0190 | 0;
}

function _fill_window($0) {
 $0 = $0 | 0;
 var $$ = 0, $$$i = 0, $$0$i = 0, $$0101 = 0, $$0102 = 0, $$025$i = 0, $$027$i = 0, $$1$i = 0, $$103 = 0, $$128$i = 0, $1 = 0, $10 = 0, $106 = 0, $107 = 0, $108 = 0, $11 = 0, $111 = 0, $119 = 0, $12 = 0, $13 = 0, $135 = 0, $136 = 0, $137 = 0, $14 = 0, $141 = 0, $143 = 0, $148 = 0, $15 = 0, $150 = 0, $151 = 0, $16 = 0, $17 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $24 = 0, $26 = 0, $3 = 0, $32 = 0, $35 = 0, $36 = 0, $4 = 0, $41 = 0, $5 = 0, $52 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $66 = 0, $67 = 0, $68 = 0, $7 = 0, $77 = 0, $8 = 0, $80 = 0, $85 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $94 = 0, $95 = 0, $98 = 0, $99 = 0;
 $1 = $0 + 44 | 0;
 $2 = HEAP32[$1 >> 2] | 0;
 $3 = $0 + 60 | 0;
 $4 = $0 + 116 | 0;
 $5 = $0 + 108 | 0;
 $6 = $2 + -262 | 0;
 $7 = $0 + 56 | 0;
 $8 = $0 + 5812 | 0;
 $9 = $0 + 72 | 0;
 $10 = $0 + 88 | 0;
 $11 = $0 + 84 | 0;
 $12 = $0 + 68 | 0;
 $13 = $0 + 52 | 0;
 $14 = $0 + 64 | 0;
 $15 = $0 + 112 | 0;
 $16 = $0 + 92 | 0;
 $17 = $0 + 76 | 0;
 $20 = HEAP32[$4 >> 2] | 0;
 $24 = $2;
 while (1) {
  $21 = HEAP32[$5 >> 2] | 0;
  $22 = (HEAP32[$3 >> 2] | 0) - $20 - $21 | 0;
  if ($21 >>> 0 < ($6 + $24 | 0) >>> 0) {
   $$0101 = $22;
   $66 = $21;
  } else {
   $26 = HEAP32[$7 >> 2] | 0;
   _memcpy($26 | 0, $26 + $2 | 0, $2 - $22 | 0) | 0;
   HEAP32[$15 >> 2] = (HEAP32[$15 >> 2] | 0) - $2;
   $32 = (HEAP32[$5 >> 2] | 0) - $2 | 0;
   HEAP32[$5 >> 2] = $32;
   HEAP32[$16 >> 2] = (HEAP32[$16 >> 2] | 0) - $2;
   $35 = HEAP32[$1 >> 2] | 0;
   $36 = HEAP32[$17 >> 2] | 0;
   $$0$i = $36;
   $$027$i = (HEAP32[$12 >> 2] | 0) + ($36 << 1) | 0;
   do {
    $$027$i = $$027$i + -2 | 0;
    $41 = HEAPU16[$$027$i >> 1] | 0;
    HEAP16[$$027$i >> 1] = $41 >>> 0 < $35 >>> 0 ? 0 : $41 - $35 & 65535;
    $$0$i = $$0$i + -1 | 0;
   } while (($$0$i | 0) != 0);
   $$1$i = $35;
   $$128$i = (HEAP32[$14 >> 2] | 0) + ($35 << 1) | 0;
   do {
    $$128$i = $$128$i + -2 | 0;
    $52 = HEAPU16[$$128$i >> 1] | 0;
    HEAP16[$$128$i >> 1] = $52 >>> 0 < $35 >>> 0 ? 0 : $52 - $35 & 65535;
    $$1$i = $$1$i + -1 | 0;
   } while (($$1$i | 0) != 0);
   $$0101 = $22 + $2 | 0;
   $66 = $32;
  }
  $60 = HEAP32[$0 >> 2] | 0;
  $61 = $60 + 4 | 0;
  $62 = HEAP32[$61 >> 2] | 0;
  if (!$62) break;
  $67 = HEAP32[$4 >> 2] | 0;
  $68 = (HEAP32[$7 >> 2] | 0) + $66 + $67 | 0;
  $$$i = $62 >>> 0 > $$0101 >>> 0 ? $$0101 : $62;
  if (!$$$i) {
   $$025$i = 0;
   $89 = $67;
  } else {
   HEAP32[$61 >> 2] = $62 - $$$i;
   _memcpy($68 | 0, HEAP32[$60 >> 2] | 0, $$$i | 0) | 0;
   switch (HEAP32[(HEAP32[$60 + 28 >> 2] | 0) + 24 >> 2] | 0) {
   case 1:
    {
     $77 = $60 + 48 | 0;
     HEAP32[$77 >> 2] = _adler32(HEAP32[$77 >> 2] | 0, $68, $$$i) | 0;
     break;
    }
   case 2:
    {
     $80 = $60 + 48 | 0;
     HEAP32[$80 >> 2] = _crc32(HEAP32[$80 >> 2] | 0, $68, $$$i) | 0;
     break;
    }
   default:
    {}
   }
   HEAP32[$60 >> 2] = (HEAP32[$60 >> 2] | 0) + $$$i;
   $85 = $60 + 8 | 0;
   HEAP32[$85 >> 2] = (HEAP32[$85 >> 2] | 0) + $$$i;
   $$025$i = $$$i;
   $89 = HEAP32[$4 >> 2] | 0;
  }
  $88 = $89 + $$025$i | 0;
  HEAP32[$4 >> 2] = $88;
  $90 = HEAP32[$8 >> 2] | 0;
  L20 : do if (($90 + $88 | 0) >>> 0 > 2) {
   $94 = (HEAP32[$5 >> 2] | 0) - $90 | 0;
   $95 = HEAP32[$7 >> 2] | 0;
   $98 = HEAPU8[$95 + $94 >> 0] | 0;
   HEAP32[$9 >> 2] = $98;
   $99 = HEAP32[$10 >> 2] | 0;
   $106 = HEAP32[$11 >> 2] | 0;
   $107 = ((HEAPU8[$95 + ($94 + 1) >> 0] | 0) ^ $98 << $99) & $106;
   HEAP32[$9 >> 2] = $107;
   $$0102 = $94;
   $108 = $90;
   $111 = $107;
   while (1) {
    if (!$108) break L20;
    $111 = ((HEAPU8[$95 + ($$0102 + 2) >> 0] | 0) ^ $111 << $99) & $106;
    HEAP32[$9 >> 2] = $111;
    $119 = (HEAP32[$12 >> 2] | 0) + ($111 << 1) | 0;
    HEAP16[(HEAP32[$14 >> 2] | 0) + ((HEAP32[$13 >> 2] & $$0102) << 1) >> 1] = HEAP16[$119 >> 1] | 0;
    HEAP16[$119 >> 1] = $$0102;
    $108 = $108 + -1 | 0;
    HEAP32[$8 >> 2] = $108;
    if (($88 + $108 | 0) >>> 0 < 3) break; else $$0102 = $$0102 + 1 | 0;
   }
  } while (0);
  if ($88 >>> 0 >= 262) break;
  if (!(HEAP32[(HEAP32[$0 >> 2] | 0) + 4 >> 2] | 0)) break;
  $20 = $88;
  $24 = HEAP32[$1 >> 2] | 0;
 }
 $135 = $0 + 5824 | 0;
 $136 = HEAP32[$135 >> 2] | 0;
 $137 = HEAP32[$3 >> 2] | 0;
 if ($137 >>> 0 <= $136 >>> 0) return;
 $141 = (HEAP32[$4 >> 2] | 0) + (HEAP32[$5 >> 2] | 0) | 0;
 if ($136 >>> 0 < $141 >>> 0) {
  $143 = $137 - $141 | 0;
  $$ = $143 >>> 0 > 258 ? 258 : $143;
  _memset((HEAP32[$7 >> 2] | 0) + $141 | 0, 0, $$ | 0) | 0;
  HEAP32[$135 >> 2] = $$ + $141;
  return;
 }
 $148 = $141 + 258 | 0;
 if ($148 >>> 0 <= $136 >>> 0) return;
 $150 = $148 - $136 | 0;
 $151 = $137 - $136 | 0;
 $$103 = $150 >>> 0 > $151 >>> 0 ? $151 : $150;
 _memset((HEAP32[$7 >> 2] | 0) + $136 | 0, 0, $$103 | 0) | 0;
 HEAP32[$135 >> 2] = (HEAP32[$135 >> 2] | 0) + $$103;
 return;
}

function _crc32_z($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0$lcssa$i = 0, $$07699$i = 0, $$07898$i = 0, $$08297$i = 0, $$092$i = 0, $$1 = 0, $$1$lcssa$i = 0, $$177$lcssa$i = 0, $$17791$i = 0, $$179$lcssa$i = 0, $$17990$i = 0, $$183$i = 0, $$187$i = 0, $$2$lcssa$i = 0, $$280$lcssa$i = 0, $$28085$i = 0, $$286$i = 0, $$3$i = 0, $$381$i = 0, $$4$i = 0, $110 = 0, $130 = 0, $150 = 0, $16 = 0, $17 = 0, $170 = 0, $192 = 0, $20 = 0, $21 = 0, $222 = 0, $25 = 0, $26 = 0, $27 = 0, $30 = 0, $4 = 0, $50 = 0, $70 = 0, $90 = 0, $scevgep115$i = 0;
 if (!$1) {
  $$1 = 0;
  return $$1 | 0;
 }
 $4 = ~$0;
 L4 : do if (!$2) $$4$i = $4; else {
  $$07699$i = $4;
  $$07898$i = $2;
  $$08297$i = $1;
  while (1) {
   if (!($$08297$i & 3)) break;
   $16 = HEAP32[1600 + (((HEAPU8[$$08297$i >> 0] | 0) ^ $$07699$i & 255) << 2) >> 2] ^ $$07699$i >>> 8;
   $17 = $$07898$i + -1 | 0;
   if (!$17) {
    $$4$i = $16;
    break L4;
   } else {
    $$07699$i = $16;
    $$07898$i = $17;
    $$08297$i = $$08297$i + 1 | 0;
   }
  }
  if ($$07898$i >>> 0 > 31) {
   $20 = $$07898$i + -32 | 0;
   $21 = $20 & -32;
   $scevgep115$i = $$08297$i + ($21 + 32) | 0;
   $$092$i = $$08297$i;
   $$17791$i = $$07699$i;
   $$17990$i = $$07898$i;
   while (1) {
    $30 = HEAP32[$$092$i >> 2] ^ $$17791$i;
    $50 = HEAP32[3648 + (($30 >>> 8 & 255) << 2) >> 2] ^ HEAP32[4672 + (($30 & 255) << 2) >> 2] ^ HEAP32[2624 + (($30 >>> 16 & 255) << 2) >> 2] ^ HEAP32[1600 + ($30 >>> 24 << 2) >> 2] ^ HEAP32[$$092$i + 4 >> 2];
    $70 = HEAP32[3648 + (($50 >>> 8 & 255) << 2) >> 2] ^ HEAP32[4672 + (($50 & 255) << 2) >> 2] ^ HEAP32[2624 + (($50 >>> 16 & 255) << 2) >> 2] ^ HEAP32[1600 + ($50 >>> 24 << 2) >> 2] ^ HEAP32[$$092$i + 8 >> 2];
    $90 = HEAP32[3648 + (($70 >>> 8 & 255) << 2) >> 2] ^ HEAP32[4672 + (($70 & 255) << 2) >> 2] ^ HEAP32[2624 + (($70 >>> 16 & 255) << 2) >> 2] ^ HEAP32[1600 + ($70 >>> 24 << 2) >> 2] ^ HEAP32[$$092$i + 12 >> 2];
    $110 = HEAP32[3648 + (($90 >>> 8 & 255) << 2) >> 2] ^ HEAP32[4672 + (($90 & 255) << 2) >> 2] ^ HEAP32[2624 + (($90 >>> 16 & 255) << 2) >> 2] ^ HEAP32[1600 + ($90 >>> 24 << 2) >> 2] ^ HEAP32[$$092$i + 16 >> 2];
    $130 = HEAP32[3648 + (($110 >>> 8 & 255) << 2) >> 2] ^ HEAP32[4672 + (($110 & 255) << 2) >> 2] ^ HEAP32[2624 + (($110 >>> 16 & 255) << 2) >> 2] ^ HEAP32[1600 + ($110 >>> 24 << 2) >> 2] ^ HEAP32[$$092$i + 20 >> 2];
    $150 = HEAP32[3648 + (($130 >>> 8 & 255) << 2) >> 2] ^ HEAP32[4672 + (($130 & 255) << 2) >> 2] ^ HEAP32[2624 + (($130 >>> 16 & 255) << 2) >> 2] ^ HEAP32[1600 + ($130 >>> 24 << 2) >> 2] ^ HEAP32[$$092$i + 24 >> 2];
    $170 = HEAP32[3648 + (($150 >>> 8 & 255) << 2) >> 2] ^ HEAP32[4672 + (($150 & 255) << 2) >> 2] ^ HEAP32[2624 + (($150 >>> 16 & 255) << 2) >> 2] ^ HEAP32[1600 + ($150 >>> 24 << 2) >> 2] ^ HEAP32[$$092$i + 28 >> 2];
    $$17791$i = HEAP32[3648 + (($170 >>> 8 & 255) << 2) >> 2] ^ HEAP32[4672 + (($170 & 255) << 2) >> 2] ^ HEAP32[2624 + (($170 >>> 16 & 255) << 2) >> 2] ^ HEAP32[1600 + ($170 >>> 24 << 2) >> 2];
    $$17990$i = $$17990$i + -32 | 0;
    if ($$17990$i >>> 0 <= 31) break; else $$092$i = $$092$i + 32 | 0;
   }
   $$0$lcssa$i = $scevgep115$i;
   $$177$lcssa$i = $$17791$i;
   $$179$lcssa$i = $20 - $21 | 0;
  } else {
   $$0$lcssa$i = $$08297$i;
   $$177$lcssa$i = $$07699$i;
   $$179$lcssa$i = $$07898$i;
  }
  if ($$179$lcssa$i >>> 0 > 3) {
   $25 = $$179$lcssa$i + -4 | 0;
   $26 = $25 >>> 2;
   $27 = $26 + 1 | 0;
   $$187$i = $$0$lcssa$i;
   $$28085$i = $$179$lcssa$i;
   $$286$i = $$177$lcssa$i;
   while (1) {
    $192 = HEAP32[$$187$i >> 2] ^ $$286$i;
    $$286$i = HEAP32[3648 + (($192 >>> 8 & 255) << 2) >> 2] ^ HEAP32[4672 + (($192 & 255) << 2) >> 2] ^ HEAP32[2624 + (($192 >>> 16 & 255) << 2) >> 2] ^ HEAP32[1600 + ($192 >>> 24 << 2) >> 2];
    $$28085$i = $$28085$i + -4 | 0;
    if ($$28085$i >>> 0 <= 3) break; else $$187$i = $$187$i + 4 | 0;
   }
   $$1$lcssa$i = $$0$lcssa$i + ($27 << 2) | 0;
   $$2$lcssa$i = $$286$i;
   $$280$lcssa$i = $25 - ($26 << 2) | 0;
  } else {
   $$1$lcssa$i = $$0$lcssa$i;
   $$2$lcssa$i = $$177$lcssa$i;
   $$280$lcssa$i = $$179$lcssa$i;
  }
  if (!$$280$lcssa$i) $$4$i = $$2$lcssa$i; else {
   $$183$i = $$1$lcssa$i;
   $$3$i = $$2$lcssa$i;
   $$381$i = $$280$lcssa$i;
   while (1) {
    $222 = HEAP32[1600 + (((HEAPU8[$$183$i >> 0] | 0) ^ $$3$i & 255) << 2) >> 2] ^ $$3$i >>> 8;
    $$381$i = $$381$i + -1 | 0;
    if (!$$381$i) {
     $$4$i = $222;
     break;
    } else {
     $$183$i = $$183$i + 1 | 0;
     $$3$i = $222;
    }
   }
  }
 } while (0);
 $$1 = ~$$4$i;
 return $$1 | 0;
}

function __ZNSt3__216__copy_unalignedINS_6vectorIbNS_9allocatorIbEEEELb0EEENS_14__bit_iteratorIT_Lb0EXLi0EEEENS5_IS6_XT0_EXLi0EEEES8_S7_($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $$0 = 0, $$1$lcssa = 0, $$189 = 0, $$phi$trans$insert = 0, $$pre$phi93Z2D = 0, $$pre$phiZ2D = 0, $$sroa$speculated = 0, $$sroa$speculated61 = 0, $$sroa$speculated73 = 0, $101 = 0, $106 = 0, $108 = 0, $11 = 0, $110 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $13 = 0, $15 = 0, $17 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $35 = 0, $37 = 0, $38 = 0, $39 = 0, $46 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $56 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $67 = 0, $68 = 0, $69 = 0, $70 = 0, $72 = 0, $76 = 0, $90 = 0, $91 = 0, $99 = 0;
 $5 = HEAP32[$1 >> 2] | 0;
 $11 = $1 + 4 | 0;
 $12 = HEAP32[$11 >> 2] | 0;
 $13 = ((HEAP32[$2 >> 2] | 0) - $5 << 3) + (HEAP32[$2 + 4 >> 2] | 0) - $12 | 0;
 $15 = $5;
 if (($13 | 0) <= 0) {
  $$pre$phi93Z2D = $3 + 4 | 0;
  $119 = HEAP32[$3 >> 2] | 0;
  HEAP32[$0 >> 2] = $119;
  $120 = $0 + 4 | 0;
  $121 = HEAP32[$$pre$phi93Z2D >> 2] | 0;
  HEAP32[$120 >> 2] = $121;
  return;
 }
 if (!$12) {
  $$phi$trans$insert = $3 + 4 | 0;
  $$0 = $13;
  $$pre$phiZ2D = $$phi$trans$insert;
  $122 = $15;
  $64 = HEAP32[$$phi$trans$insert >> 2] | 0;
 } else {
  $17 = 32 - $12 | 0;
  $$sroa$speculated73 = ($13 | 0) < ($17 | 0) ? $13 : $17;
  $25 = -1 >>> ($17 - $$sroa$speculated73 | 0) & -1 << $12 & HEAP32[$15 >> 2];
  $26 = $3 + 4 | 0;
  $27 = HEAP32[$26 >> 2] | 0;
  $28 = 32 - $27 | 0;
  $$sroa$speculated61 = $28 >>> 0 < $$sroa$speculated73 >>> 0 ? $28 : $$sroa$speculated73;
  $35 = HEAP32[$3 >> 2] | 0;
  $37 = HEAP32[$35 >> 2] & ~(-1 >>> ($28 - $$sroa$speculated61 | 0) & -1 << $27);
  HEAP32[$35 >> 2] = $37;
  $38 = HEAP32[$26 >> 2] | 0;
  $39 = HEAP32[$11 >> 2] | 0;
  HEAP32[$35 >> 2] = $37 | ($38 >>> 0 > $39 >>> 0 ? $25 << $38 - $39 : $25 >>> ($39 - $38 | 0));
  $46 = (HEAP32[$26 >> 2] | 0) + $$sroa$speculated61 | 0;
  $48 = $35 + ($46 >>> 5 << 2) | 0;
  HEAP32[$3 >> 2] = $48;
  $49 = $46 & 31;
  HEAP32[$26 >> 2] = $49;
  $50 = $$sroa$speculated73 - $$sroa$speculated61 | 0;
  if (($50 | 0) > 0) {
   $56 = HEAP32[$48 >> 2] & ~(-1 >>> (32 - $50 | 0));
   HEAP32[$48 >> 2] = $56;
   HEAP32[$48 >> 2] = $56 | $25 >>> ((HEAP32[$11 >> 2] | 0) + $$sroa$speculated61 | 0);
   HEAP32[$26 >> 2] = $50;
   $123 = $50;
  } else $123 = $49;
  $62 = (HEAP32[$1 >> 2] | 0) + 4 | 0;
  HEAP32[$1 >> 2] = $62;
  $$0 = $13 - $$sroa$speculated73 | 0;
  $$pre$phiZ2D = $26;
  $122 = $62;
  $64 = $123;
 }
 $63 = 32 - $64 | 0;
 $65 = -1 << $64;
 if ($$0 >>> 0 > 31) {
  $67 = ~$65;
  $$189 = $$0;
  $69 = $122;
  do {
   $68 = HEAP32[$69 >> 2] | 0;
   $70 = HEAP32[$3 >> 2] | 0;
   $72 = HEAP32[$70 >> 2] & $67;
   HEAP32[$70 >> 2] = $72;
   HEAP32[$70 >> 2] = $72 | $68 << HEAP32[$$pre$phiZ2D >> 2];
   $76 = $70 + 4 | 0;
   HEAP32[$3 >> 2] = $76;
   HEAP32[$76 >> 2] = HEAP32[$76 >> 2] & $65 | $68 >>> $63;
   $$189 = $$189 + -32 | 0;
   $69 = (HEAP32[$1 >> 2] | 0) + 4 | 0;
   HEAP32[$1 >> 2] = $69;
  } while ($$189 >>> 0 > 31);
  $$1$lcssa = $$0 & 31;
  $90 = $69;
 } else {
  $$1$lcssa = $$0;
  $90 = $122;
 }
 if (!$$1$lcssa) {
  $$pre$phi93Z2D = $$pre$phiZ2D;
  $119 = HEAP32[$3 >> 2] | 0;
  HEAP32[$0 >> 2] = $119;
  $120 = $0 + 4 | 0;
  $121 = HEAP32[$$pre$phi93Z2D >> 2] | 0;
  HEAP32[$120 >> 2] = $121;
  return;
 }
 $91 = HEAP32[$90 >> 2] & -1 >>> (32 - $$1$lcssa | 0);
 $$sroa$speculated = ($63 | 0) < ($$1$lcssa | 0) ? $63 : $$1$lcssa;
 $99 = HEAP32[$3 >> 2] | 0;
 $101 = HEAP32[$99 >> 2] & ~(-1 << HEAP32[$$pre$phiZ2D >> 2] & -1 >>> ($63 - $$sroa$speculated | 0));
 HEAP32[$99 >> 2] = $101;
 HEAP32[$99 >> 2] = $101 | $91 << HEAP32[$$pre$phiZ2D >> 2];
 $106 = (HEAP32[$$pre$phiZ2D >> 2] | 0) + $$sroa$speculated | 0;
 $108 = $99 + ($106 >>> 5 << 2) | 0;
 HEAP32[$3 >> 2] = $108;
 HEAP32[$$pre$phiZ2D >> 2] = $106 & 31;
 $110 = $$1$lcssa - $$sroa$speculated | 0;
 if (($110 | 0) <= 0) {
  $$pre$phi93Z2D = $$pre$phiZ2D;
  $119 = HEAP32[$3 >> 2] | 0;
  HEAP32[$0 >> 2] = $119;
  $120 = $0 + 4 | 0;
  $121 = HEAP32[$$pre$phi93Z2D >> 2] | 0;
  HEAP32[$120 >> 2] = $121;
  return;
 }
 HEAP32[$108 >> 2] = HEAP32[$108 >> 2] & ~(-1 >>> (32 - $110 | 0)) | $91 >>> $$sroa$speculated;
 HEAP32[$$pre$phiZ2D >> 2] = $110;
 $$pre$phi93Z2D = $$pre$phiZ2D;
 $119 = HEAP32[$3 >> 2] | 0;
 HEAP32[$0 >> 2] = $119;
 $120 = $0 + 4 | 0;
 $121 = HEAP32[$$pre$phi93Z2D >> 2] | 0;
 HEAP32[$120 >> 2] = $121;
 return;
}

function __ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0, $1, $2, $3, $4) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 var $$0 = 0, $$081$off0 = 0, $$084 = 0, $$085$off0 = 0, $$1 = 0, $$182$off0 = 0, $$186$off0 = 0, $$2 = 0, $$283$off0 = 0, $11 = 0, $19 = 0, $25 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $53 = 0, $61 = 0, $64 = 0, $65 = 0, $66 = 0, $69 = 0, $72 = 0, $75 = 0, $82 = 0, $83 = 0, $84 = 0, label = 0;
 L1 : do if (($0 | 0) == (HEAP32[$1 + 8 >> 2] | 0)) {
  if ((HEAP32[$1 + 4 >> 2] | 0) == ($2 | 0)) {
   $11 = $1 + 28 | 0;
   if ((HEAP32[$11 >> 2] | 0) != 1) HEAP32[$11 >> 2] = $3;
  }
 } else {
  if (($0 | 0) != (HEAP32[$1 >> 2] | 0)) {
   $64 = HEAP32[$0 + 12 >> 2] | 0;
   $65 = $0 + 16 + ($64 << 3) | 0;
   __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0 + 16 | 0, $1, $2, $3, $4);
   $66 = $0 + 24 | 0;
   if (($64 | 0) <= 1) break;
   $69 = HEAP32[$0 + 8 >> 2] | 0;
   if (!($69 & 2)) {
    $72 = $1 + 36 | 0;
    if ((HEAP32[$72 >> 2] | 0) != 1) {
     if (!($69 & 1)) {
      $84 = $1 + 54 | 0;
      $$2 = $66;
      while (1) {
       if (HEAP8[$84 >> 0] | 0) break L1;
       if ((HEAP32[$72 >> 2] | 0) == 1) break L1;
       __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$2, $1, $2, $3, $4);
       $$2 = $$2 + 8 | 0;
       if ($$2 >>> 0 >= $65 >>> 0) break L1;
      }
     }
     $82 = $1 + 24 | 0;
     $83 = $1 + 54 | 0;
     $$1 = $66;
     while (1) {
      if (HEAP8[$83 >> 0] | 0) break L1;
      if ((HEAP32[$72 >> 2] | 0) == 1) if ((HEAP32[$82 >> 2] | 0) == 1) break L1;
      __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$1, $1, $2, $3, $4);
      $$1 = $$1 + 8 | 0;
      if ($$1 >>> 0 >= $65 >>> 0) break L1;
     }
    }
   }
   $75 = $1 + 54 | 0;
   $$0 = $66;
   while (1) {
    if (HEAP8[$75 >> 0] | 0) break L1;
    __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$0, $1, $2, $3, $4);
    $$0 = $$0 + 8 | 0;
    if ($$0 >>> 0 >= $65 >>> 0) break L1;
   }
  }
  if ((HEAP32[$1 + 16 >> 2] | 0) != ($2 | 0)) {
   $19 = $1 + 20 | 0;
   if ((HEAP32[$19 >> 2] | 0) != ($2 | 0)) {
    HEAP32[$1 + 32 >> 2] = $3;
    $25 = $1 + 44 | 0;
    if ((HEAP32[$25 >> 2] | 0) == 4) break;
    $31 = $0 + 16 + (HEAP32[$0 + 12 >> 2] << 3) | 0;
    $32 = $1 + 52 | 0;
    $33 = $1 + 53 | 0;
    $34 = $1 + 54 | 0;
    $35 = $0 + 8 | 0;
    $36 = $1 + 24 | 0;
    $$081$off0 = 0;
    $$084 = $0 + 16 | 0;
    $$085$off0 = 0;
    L34 : while (1) {
     if ($$084 >>> 0 >= $31 >>> 0) {
      $$283$off0 = $$081$off0;
      label = 20;
      break;
     }
     HEAP8[$32 >> 0] = 0;
     HEAP8[$33 >> 0] = 0;
     __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($$084, $1, $2, $2, 1, $4);
     if (HEAP8[$34 >> 0] | 0) {
      $$283$off0 = $$081$off0;
      label = 20;
      break;
     }
     do if (!(HEAP8[$33 >> 0] | 0)) {
      $$182$off0 = $$081$off0;
      $$186$off0 = $$085$off0;
     } else {
      if (!(HEAP8[$32 >> 0] | 0)) if (!(HEAP32[$35 >> 2] & 1)) {
       $$283$off0 = 1;
       label = 20;
       break L34;
      } else {
       $$182$off0 = 1;
       $$186$off0 = $$085$off0;
       break;
      }
      if ((HEAP32[$36 >> 2] | 0) == 1) {
       label = 25;
       break L34;
      }
      if (!(HEAP32[$35 >> 2] & 2)) {
       label = 25;
       break L34;
      } else {
       $$182$off0 = 1;
       $$186$off0 = 1;
      }
     } while (0);
     $$081$off0 = $$182$off0;
     $$084 = $$084 + 8 | 0;
     $$085$off0 = $$186$off0;
    }
    do if ((label | 0) == 20) {
     if (!$$085$off0) {
      HEAP32[$19 >> 2] = $2;
      $53 = $1 + 40 | 0;
      HEAP32[$53 >> 2] = (HEAP32[$53 >> 2] | 0) + 1;
      if ((HEAP32[$1 + 36 >> 2] | 0) == 1) if ((HEAP32[$36 >> 2] | 0) == 2) {
       HEAP8[$34 >> 0] = 1;
       if ($$283$off0) {
        label = 25;
        break;
       } else {
        $61 = 4;
        break;
       }
      }
     }
     if ($$283$off0) label = 25; else $61 = 4;
    } while (0);
    if ((label | 0) == 25) $61 = 3;
    HEAP32[$25 >> 2] = $61;
    break;
   }
  }
  if (($3 | 0) == 1) HEAP32[$1 + 32 >> 2] = 1;
 } while (0);
 return;
}

function __Z8vecToRawRNSt3__26vectorIbNS_9allocatorIbEEEE($0) {
 $0 = $0 | 0;
 var $$ = 0, $$0$i$i$i = 0, $$02945 = 0, $$03044$lcssa = 0, $$1 = 0, $$1$in = 0, $$lcssa46 = 0, $1 = 0, $11 = 0, $111 = 0, $112 = 0, $12 = 0, $125 = 0, $126 = 0, $139 = 0, $14 = 0, $140 = 0, $2 = 0, $26 = 0, $27 = 0, $29 = 0, $3 = 0, $32 = 0, $35 = 0, $37 = 0, $39 = 0, $4 = 0, $40 = 0, $42 = 0, $44 = 0, $47 = 0, $48 = 0, $5 = 0, $54 = 0, $58 = 0, $6 = 0, $70 = 0, $71 = 0, $83 = 0, $84 = 0, $97 = 0, $98 = 0, label = 0;
 $1 = __Znwj(12) | 0;
 HEAP32[$1 >> 2] = 0;
 $2 = $1 + 4 | 0;
 HEAP32[$2 >> 2] = 0;
 $3 = $1 + 8 | 0;
 HEAP32[$3 >> 2] = 0;
 $4 = $0 + 4 | 0;
 $5 = HEAP32[$4 >> 2] | 0;
 $6 = $5 >>> 3;
 $$ = ($6 << 3 >>> 0 < $5 >>> 0 & 1) + $6 | 0;
 if (!$$) return $1 | 0;
 $$02945 = 0;
 $14 = $5;
 while (1) {
  $11 = $$02945 << 3;
  $12 = HEAP32[$0 >> 2] | 0;
  if ($11 >>> 0 < $14 >>> 0) {
   $26 = ((HEAP32[$12 + (($$02945 >>> 2 & 134217727) << 2) >> 2] & 1 << ($11 & 24) | 0) != 0 & 1) << 1;
   $27 = $11 | 1;
   if ($27 >>> 0 < $14 >>> 0) {
    $70 = ((HEAP32[$12 + (($$02945 >>> 2 & 134217727) << 2) >> 2] & 1 << ($27 & 25) | 0) != 0 | $26) << 1;
    $71 = $11 | 2;
    if ($71 >>> 0 < $14 >>> 0) {
     $83 = ((HEAP32[$12 + (($$02945 >>> 2 & 134217727) << 2) >> 2] & 1 << ($71 & 26) | 0) != 0 | $70) << 1;
     $84 = $11 | 3;
     if ($84 >>> 0 < $14 >>> 0) {
      $97 = ((HEAP32[$12 + (($$02945 >>> 2 & 134217727) << 2) >> 2] & 1 << ($84 & 27) | 0) != 0 | $83 & 510) << 1;
      $98 = $11 | 4;
      if ($98 >>> 0 < $14 >>> 0) {
       $111 = ((HEAP32[$12 + (($$02945 >>> 2 & 134217727) << 2) >> 2] & 1 << ($98 & 28) | 0) != 0 | $97 & 510) << 1;
       $112 = $11 | 5;
       if ($112 >>> 0 < $14 >>> 0) {
        $125 = ((HEAP32[$12 + (($$02945 >>> 2 & 134217727) << 2) >> 2] & 1 << ($112 & 29) | 0) != 0 | $111 & 510) << 1;
        $126 = $11 | 6;
        if ($126 >>> 0 < $14 >>> 0) {
         $139 = ((HEAP32[$12 + (($$02945 >>> 2 & 134217727) << 2) >> 2] & 1 << ($126 & 30) | 0) != 0 | $125 & 510) << 1;
         $140 = $11 | 7;
         if ($140 >>> 0 < $14 >>> 0) $$1$in = (HEAP32[$12 + (($$02945 >>> 2 & 134217727) << 2) >> 2] & 1 << ($140 & 31) | 0) != 0 | $139 & 510; else {
          $$03044$lcssa = 0;
          $$lcssa46 = $139;
          label = 4;
         }
        } else {
         $$03044$lcssa = 1;
         $$lcssa46 = $125;
         label = 4;
        }
       } else {
        $$03044$lcssa = 2;
        $$lcssa46 = $111;
        label = 4;
       }
      } else {
       $$03044$lcssa = 3;
       $$lcssa46 = $97;
       label = 4;
      }
     } else {
      $$03044$lcssa = 4;
      $$lcssa46 = $83;
      label = 4;
     }
    } else {
     $$03044$lcssa = 5;
     $$lcssa46 = $70;
     label = 4;
    }
   } else {
    $$03044$lcssa = 6;
    $$lcssa46 = $26;
    label = 4;
   }
  } else {
   $$03044$lcssa = 7;
   $$lcssa46 = 0;
   label = 4;
  }
  if ((label | 0) == 4) {
   label = 0;
   $$1$in = ($$lcssa46 & 254) << $$03044$lcssa;
  }
  $$1 = $$1$in & 255;
  $29 = HEAP32[$2 >> 2] | 0;
  $32 = $29;
  if (($29 | 0) == (HEAP32[$3 >> 2] | 0)) {
   $35 = HEAP32[$1 >> 2] | 0;
   $37 = $32 - $35 + 1 | 0;
   if (($37 | 0) < 0) {
    label = 9;
    break;
   }
   $39 = $35;
   $40 = $32 - $35 | 0;
   $42 = $40 << 1;
   $$0$i$i$i = $40 >>> 0 < 1073741823 ? ($42 >>> 0 < $37 >>> 0 ? $37 : $42) : 2147483647;
   $44 = $32 - $35 | 0;
   if (!$$0$i$i$i) $48 = 0; else $48 = __Znwj($$0$i$i$i) | 0;
   $47 = $48 + $44 | 0;
   HEAP8[$47 >> 0] = $$1;
   $54 = $47 + (0 - $44) | 0;
   if (($44 | 0) > 0) _memcpy($54 | 0, $39 | 0, $44 | 0) | 0;
   HEAP32[$1 >> 2] = $54;
   HEAP32[$2 >> 2] = $47 + 1;
   HEAP32[$3 >> 2] = $48 + $$0$i$i$i;
   if ($35 | 0) __ZdlPv($39);
  } else {
   HEAP8[$29 >> 0] = $$1;
   HEAP32[$2 >> 2] = (HEAP32[$2 >> 2] | 0) + 1;
  }
  $58 = $$02945 + 1 | 0;
  if ($58 >>> 0 >= $$ >>> 0) {
   label = 18;
   break;
  }
  $$02945 = $58;
  $14 = HEAP32[$4 >> 2] | 0;
 }
 if ((label | 0) == 9) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($1); else if ((label | 0) == 18) return $1 | 0;
 return 0;
}

function _deflateInit2_($0, $1, $2, $3, $4, $5, $6, $7) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 $5 = $5 | 0;
 $6 = $6 | 0;
 $7 = $7 | 0;
 var $$ = 0, $$$0120 = 0, $$0 = 0, $$0118 = 0, $$0120 = 0, $102 = 0, $104 = 0, $110 = 0, $113 = 0, $118 = 0, $13 = 0, $14 = 0, $15 = 0, $18 = 0, $24 = 0, $35 = 0, $37 = 0, $39 = 0, $40 = 0, $42 = 0, $43 = 0, $47 = 0, $48 = 0, $51 = 0, $53 = 0, $54 = 0, $63 = 0, $68 = 0, $73 = 0, $76 = 0, $77 = 0, $80 = 0, $82 = 0;
 if (!$6) {
  $$0 = -6;
  return $$0 | 0;
 }
 if (($7 | 0) != 56 | (HEAP8[$6 >> 0] | 0) != 49) {
  $$0 = -6;
  return $$0 | 0;
 }
 if (!$0) {
  $$0 = -2;
  return $$0 | 0;
 }
 $13 = $0 + 24 | 0;
 HEAP32[$13 >> 2] = 0;
 $14 = $0 + 32 | 0;
 $15 = HEAP32[$14 >> 2] | 0;
 if (!$15) {
  HEAP32[$14 >> 2] = 14;
  HEAP32[$0 + 40 >> 2] = 0;
  $39 = 14;
 } else $39 = $15;
 $18 = $0 + 36 | 0;
 if (!(HEAP32[$18 >> 2] | 0)) HEAP32[$18 >> 2] = 3;
 $$ = ($1 | 0) == -1 ? 6 : $1;
 if (($3 | 0) < 0) {
  $$0118 = 0;
  $$0120 = 0 - $3 | 0;
 } else {
  $24 = ($3 | 0) > 15;
  $$0118 = $24 ? 2 : 1;
  $$0120 = $24 ? $3 + -16 | 0 : $3;
 }
 if ($5 >>> 0 > 4 | ($$ >>> 0 > 9 | (($2 | 0) != 8 | ($4 + -1 | 0) >>> 0 > 8 | ($$0120 & -8 | 0) != 8))) {
  $$0 = -2;
  return $$0 | 0;
 }
 $35 = ($$0120 | 0) == 8;
 if ($35 & ($$0118 | 0) != 1) {
  $$0 = -2;
  return $$0 | 0;
 }
 $$$0120 = $35 ? 9 : $$0120;
 $37 = $0 + 40 | 0;
 $40 = FUNCTION_TABLE_iiii[$39 & 15](HEAP32[$37 >> 2] | 0, 1, 5828) | 0;
 if (!$40) {
  $$0 = -4;
  return $$0 | 0;
 }
 $42 = $0 + 28 | 0;
 HEAP32[$42 >> 2] = $40;
 HEAP32[$40 >> 2] = $0;
 $43 = $40 + 4 | 0;
 HEAP32[$43 >> 2] = 42;
 HEAP32[$40 + 24 >> 2] = $$0118;
 HEAP32[$40 + 28 >> 2] = 0;
 HEAP32[$40 + 48 >> 2] = $$$0120;
 $47 = 1 << $$$0120;
 $48 = $40 + 44 | 0;
 HEAP32[$48 >> 2] = $47;
 HEAP32[$40 + 52 >> 2] = $47 + -1;
 $51 = $4 + 7 | 0;
 HEAP32[$40 + 80 >> 2] = $51;
 $53 = 1 << $51;
 $54 = $40 + 76 | 0;
 HEAP32[$54 >> 2] = $53;
 HEAP32[$40 + 84 >> 2] = $53 + -1;
 HEAP32[$40 + 88 >> 2] = (($4 + 9 | 0) >>> 0) / 3 | 0;
 $63 = $40 + 56 | 0;
 HEAP32[$63 >> 2] = FUNCTION_TABLE_iiii[HEAP32[$14 >> 2] & 15](HEAP32[$37 >> 2] | 0, $47, 2) | 0;
 $68 = $40 + 64 | 0;
 HEAP32[$68 >> 2] = FUNCTION_TABLE_iiii[HEAP32[$14 >> 2] & 15](HEAP32[$37 >> 2] | 0, HEAP32[$48 >> 2] | 0, 2) | 0;
 $73 = $40 + 68 | 0;
 HEAP32[$73 >> 2] = FUNCTION_TABLE_iiii[HEAP32[$14 >> 2] & 15](HEAP32[$37 >> 2] | 0, HEAP32[$54 >> 2] | 0, 2) | 0;
 HEAP32[$40 + 5824 >> 2] = 0;
 $76 = 1 << $4 + 6;
 $77 = $40 + 5788 | 0;
 HEAP32[$77 >> 2] = $76;
 $80 = FUNCTION_TABLE_iiii[HEAP32[$14 >> 2] & 15](HEAP32[$37 >> 2] | 0, $76, 4) | 0;
 HEAP32[$40 + 8 >> 2] = $80;
 $82 = HEAP32[$77 >> 2] | 0;
 HEAP32[$40 + 12 >> 2] = $82 << 2;
 if (HEAP32[$63 >> 2] | 0) if (HEAP32[$68 >> 2] | 0) if (!((HEAP32[$73 >> 2] | 0) == 0 | ($80 | 0) == 0)) {
  HEAP32[$40 + 5796 >> 2] = $80 + ($82 >>> 1 << 1);
  HEAP32[$40 + 5784 >> 2] = $80 + ($82 * 3 | 0);
  HEAP32[$40 + 132 >> 2] = $$;
  HEAP32[$40 + 136 >> 2] = $5;
  HEAP8[$40 + 36 >> 0] = 8;
  $102 = _deflateResetKeep($0) | 0;
  if ($102 | 0) {
   $$0 = $102;
   return $$0 | 0;
  }
  $104 = HEAP32[$42 >> 2] | 0;
  HEAP32[$104 + 60 >> 2] = HEAP32[$104 + 44 >> 2] << 1;
  $110 = HEAP32[$104 + 76 >> 2] | 0;
  $113 = HEAP32[$104 + 68 >> 2] | 0;
  HEAP16[$113 + ($110 + -1 << 1) >> 1] = 0;
  _memset($113 | 0, 0, ($110 << 1) + -2 | 0) | 0;
  $118 = HEAP32[$104 + 132 >> 2] | 0;
  HEAP32[$104 + 128 >> 2] = HEAPU16[832 + ($118 * 12 | 0) + 2 >> 1];
  HEAP32[$104 + 140 >> 2] = HEAPU16[832 + ($118 * 12 | 0) >> 1];
  HEAP32[$104 + 144 >> 2] = HEAPU16[832 + ($118 * 12 | 0) + 4 >> 1];
  HEAP32[$104 + 124 >> 2] = HEAPU16[832 + ($118 * 12 | 0) + 6 >> 1];
  HEAP32[$104 + 108 >> 2] = 0;
  HEAP32[$104 + 92 >> 2] = 0;
  HEAP32[$104 + 116 >> 2] = 0;
  HEAP32[$104 + 5812 >> 2] = 0;
  HEAP32[$104 + 120 >> 2] = 2;
  HEAP32[$104 + 96 >> 2] = 2;
  HEAP32[$104 + 104 >> 2] = 0;
  HEAP32[$104 + 72 >> 2] = 0;
  $$0 = 0;
  return $$0 | 0;
 }
 HEAP32[$43 >> 2] = 666;
 HEAP32[$13 >> 2] = HEAP32[396];
 _deflateEnd($0) | 0;
 $$0 = -4;
 return $$0 | 0;
}

function __ZNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEE6assignIPS3_EENS_9enable_ifIXaasr21__is_forward_iteratorIT_EE5valuesr16is_constructibleIS3_NS_15iterator_traitsIS9_E9referenceEEE5valueEvE4typeES9_S9_($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$ = 0, $$0$i = 0, $$0$lcssa$i$i = 0, $$067$i$i = 0, $$07$i$i = 0, $$07$i$i21 = 0, $$08$i$i = 0, $13 = 0, $14 = 0, $17 = 0, $18 = 0, $19 = 0, $26 = 0, $29 = 0, $34 = 0, $36 = 0, $37 = 0, $38 = 0, $40 = 0, $41 = 0, $43 = 0, $44 = 0, $52 = 0, $53 = 0, $55 = 0, $56 = 0, $57 = 0, $59 = 0, $6 = 0, $60 = 0, $62 = 0, $63 = 0, $69 = 0, $7 = 0, $72 = 0, $73 = 0, $75 = 0, $79 = 0, $8 = 0, $80 = 0, $83 = 0, $9 = 0;
 $6 = ($2 - $1 | 0) / 12 | 0;
 $7 = $0 + 8 | 0;
 $8 = HEAP32[$7 >> 2] | 0;
 $9 = HEAP32[$0 >> 2] | 0;
 $13 = $9;
 if ($6 >>> 0 > (($8 - $9 | 0) / 12 | 0) >>> 0) {
  if (!$9) $72 = $8; else {
   $52 = $0 + 4 | 0;
   $53 = HEAP32[$52 >> 2] | 0;
   if (($53 | 0) == ($13 | 0)) $69 = $9; else {
    $56 = $53;
    while (1) {
     $55 = $56 + -12 | 0;
     HEAP32[$52 >> 2] = $55;
     $57 = HEAP32[$55 >> 2] | 0;
     $59 = $57;
     if (!$57) $60 = $55; else {
      $62 = $56 + -8 | 0;
      $63 = HEAP32[$62 >> 2] | 0;
      if (($63 | 0) != ($57 | 0)) HEAP32[$62 >> 2] = $63 + (~(($63 + -2 - $59 | 0) >>> 1) << 1);
      __ZdlPv($57);
      $60 = HEAP32[$52 >> 2] | 0;
     }
     if (($60 | 0) == ($13 | 0)) break; else $56 = $60;
    }
    $69 = HEAP32[$0 >> 2] | 0;
   }
   __ZdlPv($69);
   HEAP32[$7 >> 2] = 0;
   HEAP32[$52 >> 2] = 0;
   HEAP32[$0 >> 2] = 0;
   $72 = 0;
  }
  if ($6 >>> 0 > 357913941) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  $73 = ($72 - 0 | 0) / 12 | 0;
  $75 = $73 << 1;
  $$0$i = $73 >>> 0 < 178956970 ? ($75 >>> 0 < $6 >>> 0 ? $6 : $75) : 357913941;
  if ($$0$i >>> 0 > 357913941) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
  $79 = __Znwj($$0$i * 12 | 0) | 0;
  $80 = $0 + 4 | 0;
  HEAP32[$80 >> 2] = $79;
  HEAP32[$0 >> 2] = $79;
  HEAP32[$7 >> 2] = $79 + ($$0$i * 12 | 0);
  if (($1 | 0) == ($2 | 0)) return;
  $$07$i$i = $1;
  $83 = $79;
  do {
   __ZNSt3__26vectorIsNS_9allocatorIsEEEC2ERKS3_($83, $$07$i$i);
   $$07$i$i = $$07$i$i + 12 | 0;
   $83 = (HEAP32[$80 >> 2] | 0) + 12 | 0;
   HEAP32[$80 >> 2] = $83;
  } while (($$07$i$i | 0) != ($2 | 0));
  return;
 } else {
  $14 = $0 + 4 | 0;
  $17 = ((HEAP32[$14 >> 2] | 0) - $9 | 0) / 12 | 0;
  $18 = $6 >>> 0 > $17 >>> 0;
  $19 = $1 + ($17 * 12 | 0) | 0;
  $$ = $18 ? $19 : $2;
  if (($$ | 0) == ($1 | 0)) $$0$lcssa$i$i = $13; else {
   $$067$i$i = $1;
   $$08$i$i = $13;
   while (1) {
    if (($$08$i$i | 0) != ($$067$i$i | 0)) __ZNSt3__26vectorIsNS_9allocatorIsEEE6assignIPsEENS_9enable_ifIXaasr21__is_forward_iteratorIT_EE5valuesr16is_constructibleIsNS_15iterator_traitsIS7_E9referenceEEE5valueEvE4typeES7_S7_($$08$i$i, HEAP32[$$067$i$i >> 2] | 0, HEAP32[$$067$i$i + 4 >> 2] | 0);
    $$067$i$i = $$067$i$i + 12 | 0;
    $26 = $$08$i$i + 12 | 0;
    if (($$067$i$i | 0) == ($$ | 0)) {
     $$0$lcssa$i$i = $26;
     break;
    } else $$08$i$i = $26;
   }
  }
  if ($18) {
   if (($$ | 0) == ($2 | 0)) return;
   $$07$i$i21 = $19;
   $29 = HEAP32[$14 >> 2] | 0;
   do {
    __ZNSt3__26vectorIsNS_9allocatorIsEEEC2ERKS3_($29, $$07$i$i21);
    $$07$i$i21 = $$07$i$i21 + 12 | 0;
    $29 = (HEAP32[$14 >> 2] | 0) + 12 | 0;
    HEAP32[$14 >> 2] = $29;
   } while (($$07$i$i21 | 0) != ($2 | 0));
   return;
  }
  $34 = HEAP32[$14 >> 2] | 0;
  if (($34 | 0) == ($$0$lcssa$i$i | 0)) return; else $37 = $34;
  while (1) {
   $36 = $37 + -12 | 0;
   HEAP32[$14 >> 2] = $36;
   $38 = HEAP32[$36 >> 2] | 0;
   $40 = $38;
   if (!$38) $41 = $36; else {
    $43 = $37 + -8 | 0;
    $44 = HEAP32[$43 >> 2] | 0;
    if (($44 | 0) != ($38 | 0)) HEAP32[$43 >> 2] = $44 + (~(($44 + -2 - $40 | 0) >>> 1) << 1);
    __ZdlPv($38);
    $41 = HEAP32[$14 >> 2] | 0;
   }
   if (($41 | 0) == ($$0$lcssa$i$i | 0)) break; else $37 = $41;
  }
  return;
 }
}

function _longest_match($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$ = 0, $$0 = 0, $$0105 = 0, $$0108 = 0, $$0114 = 0, $$1 = 0, $$1106 = 0, $$1110 = 0, $$1112$idx = 0, $$1112$ptr = 0, $$1115 = 0, $$118 = 0, $$2 = 0, $$2116 = 0, $$ptr = 0, $10 = 0, $12 = 0, $15 = 0, $19 = 0, $21 = 0, $3 = 0, $32 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $48 = 0, $5 = 0, $52 = 0, $55 = 0, $58 = 0, $63 = 0, $68 = 0, $7 = 0, $73 = 0, $78 = 0, $8 = 0, $83 = 0, $94 = 0, $95 = 0, label = 0, $55$looptemp = 0;
 $3 = HEAP32[$0 + 124 >> 2] | 0;
 $5 = HEAP32[$0 + 56 >> 2] | 0;
 $7 = HEAP32[$0 + 108 >> 2] | 0;
 $8 = $5 + $7 | 0;
 $10 = HEAP32[$0 + 120 >> 2] | 0;
 $12 = HEAP32[$0 + 144 >> 2] | 0;
 $15 = (HEAP32[$0 + 44 >> 2] | 0) + -262 | 0;
 $$ = $7 >>> 0 > $15 >>> 0 ? $7 - $15 | 0 : 0;
 $19 = HEAP32[$0 + 64 >> 2] | 0;
 $21 = HEAP32[$0 + 52 >> 2] | 0;
 $32 = HEAP32[$0 + 116 >> 2] | 0;
 $$118 = $12 >>> 0 > $32 >>> 0 ? $32 : $12;
 $34 = $0 + 112 | 0;
 $35 = $8 + 1 | 0;
 $36 = $8 + 258 | 0;
 $$0 = HEAP8[$8 + $10 >> 0] | 0;
 $$0105 = HEAP8[$8 + ($10 + -1) >> 0] | 0;
 $$0108 = $1;
 $$0114 = $10;
 $$1110 = $10 >>> 0 < (HEAP32[$0 + 140 >> 2] | 0) >>> 0 ? $3 : $3 >>> 2;
 while (1) {
  $37 = $5 + $$0108 | 0;
  if ((HEAP8[$37 + $$0114 >> 0] | 0) == $$0 << 24 >> 24) if ((HEAP8[$37 + ($$0114 + -1) >> 0] | 0) == $$0105 << 24 >> 24) if ((HEAP8[$37 >> 0] | 0) == (HEAP8[$8 >> 0] | 0)) {
   $48 = $37 + 1 | 0;
   if ((HEAP8[$48 >> 0] | 0) == (HEAP8[$35 >> 0] | 0)) {
    $$1112$idx = 2;
    $55 = $48;
    while (1) {
     $$1112$ptr = $8 + $$1112$idx | 0;
     $52 = $$1112$ptr + 1 | 0;
     if ((HEAP8[$52 >> 0] | 0) != (HEAP8[$55 + 2 >> 0] | 0)) {
      $$2 = $52;
      break;
     }
     $58 = $$1112$ptr + 2 | 0;
     if ((HEAP8[$58 >> 0] | 0) != (HEAP8[$55 + 3 >> 0] | 0)) {
      $$2 = $58;
      break;
     }
     $63 = $$1112$ptr + 3 | 0;
     if ((HEAP8[$63 >> 0] | 0) != (HEAP8[$55 + 4 >> 0] | 0)) {
      $$2 = $63;
      break;
     }
     $68 = $$1112$ptr + 4 | 0;
     if ((HEAP8[$68 >> 0] | 0) != (HEAP8[$55 + 5 >> 0] | 0)) {
      $$2 = $68;
      break;
     }
     $73 = $$1112$ptr + 5 | 0;
     if ((HEAP8[$73 >> 0] | 0) != (HEAP8[$55 + 6 >> 0] | 0)) {
      $$2 = $73;
      break;
     }
     $78 = $$1112$ptr + 6 | 0;
     if ((HEAP8[$78 >> 0] | 0) != (HEAP8[$55 + 7 >> 0] | 0)) {
      $$2 = $78;
      break;
     }
     $83 = $$1112$ptr + 7 | 0;
     $55$looptemp = $55;
     $55 = $55 + 8 | 0;
     if ((HEAP8[$83 >> 0] | 0) != (HEAP8[$55 >> 0] | 0)) {
      $$2 = $83;
      break;
     }
     $$1112$idx = $$1112$idx + 8 | 0;
     $$ptr = $8 + $$1112$idx | 0;
     if (!(($$1112$idx | 0) < 258 ? (HEAP8[$$ptr >> 0] | 0) == (HEAP8[$55$looptemp + 9 >> 0] | 0) : 0)) {
      $$2 = $$ptr;
      break;
     }
    }
    $94 = $$2 - $36 | 0;
    $95 = $94 + 258 | 0;
    if (($95 | 0) > ($$0114 | 0)) {
     HEAP32[$34 >> 2] = $$0108;
     if (($95 | 0) >= ($$118 | 0)) {
      $$2116 = $95;
      label = 19;
      break;
     }
     $$1 = HEAP8[$8 + $95 >> 0] | 0;
     $$1106 = HEAP8[$8 + ($94 + 257) >> 0] | 0;
     $$1115 = $95;
    } else {
     $$1 = $$0;
     $$1106 = $$0105;
     $$1115 = $$0114;
    }
   } else {
    $$1 = $$0;
    $$1106 = $$0105;
    $$1115 = $$0114;
   }
  } else {
   $$1 = $$0;
   $$1106 = $$0105;
   $$1115 = $$0114;
  } else {
   $$1 = $$0;
   $$1106 = $$0105;
   $$1115 = $$0114;
  } else {
   $$1 = $$0;
   $$1106 = $$0105;
   $$1115 = $$0114;
  }
  $$0108 = HEAPU16[$19 + (($$0108 & $21) << 1) >> 1] | 0;
  if ($$0108 >>> 0 <= $$ >>> 0) {
   $$2116 = $$1115;
   label = 19;
   break;
  }
  $$1110 = $$1110 + -1 | 0;
  if (!$$1110) {
   $$2116 = $$1115;
   label = 19;
   break;
  } else {
   $$0 = $$1;
   $$0105 = $$1106;
   $$0114 = $$1115;
  }
 }
 if ((label | 0) == 19) return ($$2116 >>> 0 > $32 >>> 0 ? $32 : $$2116) | 0;
 return 0;
}

function __Z20ihaarTransform2DFlatRNSt3__26vectorIsNS_9allocatorIsEEEEi($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0 = 0, $$03684$us = 0, $$03780$us = 0, $$03877 = 0, $$1$lcssa = 0, $$175 = 0, $$sroa$063$074 = 0, $$sroa$069$076 = 0, $10 = 0, $11 = 0, $12 = 0, $15 = 0, $17 = 0, $18 = 0, $2 = 0, $28 = 0, $29 = 0, $3 = 0, $31 = 0, $34 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $42 = 0, $43 = 0, $45 = 0, $50 = 0, $61 = 0, $63 = 0, $64 = 0, $65 = 0, $67 = 0, $68 = 0, $7 = 0, $70 = 0, $71 = 0, $77 = 0, $8 = 0, $9 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32 | 0;
 $2 = sp + 12 | 0;
 $3 = sp;
 HEAP32[$2 >> 2] = 0;
 $4 = $2 + 4 | 0;
 HEAP32[$4 >> 2] = 0;
 HEAP32[$2 + 8 >> 2] = 0;
 if (($1 | 0) > 0) {
  $7 = $3 + 4 | 0;
  $8 = $3 + 8 | 0;
  $9 = $2 + 8 | 0;
  $10 = $3 + 8 | 0;
  $$03684$us = 0;
  do {
   HEAP32[$3 >> 2] = 0;
   HEAP32[$7 >> 2] = 0;
   HEAP32[$8 >> 2] = 0;
   $11 = Math_imul($$03684$us, $1) | 0;
   $$03780$us = 0;
   $29 = 0;
   $31 = 0;
   while (1) {
    $28 = (HEAP32[$0 >> 2] | 0) + ($$03780$us + $11 << 1) | 0;
    if (($29 | 0) == ($31 | 0)) __ZNSt3__26vectorIsNS_9allocatorIsEEE21__push_back_slow_pathIRKsEEvOT_($3, $28); else {
     HEAP16[$29 >> 1] = HEAP16[$28 >> 1] | 0;
     HEAP32[$7 >> 2] = $29 + 2;
    }
    $34 = $$03780$us + 1 | 0;
    if (($34 | 0) >= ($1 | 0)) break;
    $$03780$us = $34;
    $29 = HEAP32[$7 >> 2] | 0;
    $31 = HEAP32[$10 >> 2] | 0;
   }
   $12 = HEAP32[$4 >> 2] | 0;
   if (($12 | 0) == (HEAP32[$9 >> 2] | 0)) __ZNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEE21__push_back_slow_pathIRKS3_EEvOT_($2, $3); else {
    __ZNSt3__26vectorIsNS_9allocatorIsEEEC2ERKS3_($12, $3);
    HEAP32[$4 >> 2] = (HEAP32[$4 >> 2] | 0) + 12;
   }
   $15 = HEAP32[$3 >> 2] | 0;
   $17 = $15;
   if ($15 | 0) {
    $18 = HEAP32[$7 >> 2] | 0;
    if (($18 | 0) != ($15 | 0)) HEAP32[$7 >> 2] = $18 + (~(($18 + -2 - $17 | 0) >>> 1) << 1);
    __ZdlPv($15);
   }
   $$03684$us = $$03684$us + 1 | 0;
  } while (($$03684$us | 0) < ($1 | 0));
 }
 $38 = __Z16ihaarTransform2DRNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEEE($2) | 0;
 $39 = HEAP32[$2 >> 2] | 0;
 if ($38) {
  $40 = HEAP32[$4 >> 2] | 0;
  if (($39 | 0) == ($40 | 0)) $$0 = 1; else {
   $42 = HEAP32[$0 >> 2] | 0;
   $$03877 = 0;
   $$sroa$069$076 = $39;
   while (1) {
    $43 = HEAP32[$$sroa$069$076 >> 2] | 0;
    $45 = HEAP32[$$sroa$069$076 + 4 >> 2] | 0;
    if (($43 | 0) == ($45 | 0)) $$1$lcssa = $$03877; else {
     $50 = ($45 + -2 - $43 | 0) >>> 1;
     $$175 = $$03877;
     $$sroa$063$074 = $43;
     while (1) {
      HEAP16[$42 + ($$175 << 1) >> 1] = HEAP16[$$sroa$063$074 >> 1] | 0;
      $$sroa$063$074 = $$sroa$063$074 + 2 | 0;
      if (($$sroa$063$074 | 0) == ($45 | 0)) break; else $$175 = $$175 + 1 | 0;
     }
     $$1$lcssa = $$03877 + 1 + $50 | 0;
    }
    $$sroa$069$076 = $$sroa$069$076 + 12 | 0;
    if (($$sroa$069$076 | 0) == ($40 | 0)) {
     $$0 = 1;
     break;
    } else $$03877 = $$1$lcssa;
   }
  }
 } else $$0 = 0;
 if (!$39) {
  STACKTOP = sp;
  return $$0 | 0;
 }
 $61 = HEAP32[$4 >> 2] | 0;
 if (($61 | 0) == ($39 | 0)) $77 = $39; else {
  $64 = $61;
  while (1) {
   $63 = $64 + -12 | 0;
   HEAP32[$4 >> 2] = $63;
   $65 = HEAP32[$63 >> 2] | 0;
   $67 = $65;
   if (!$65) $68 = $63; else {
    $70 = $64 + -8 | 0;
    $71 = HEAP32[$70 >> 2] | 0;
    if (($71 | 0) != ($65 | 0)) HEAP32[$70 >> 2] = $71 + (~(($71 + -2 - $67 | 0) >>> 1) << 1);
    __ZdlPv($65);
    $68 = HEAP32[$4 >> 2] | 0;
   }
   if (($68 | 0) == ($39 | 0)) break; else $64 = $68;
  }
  $77 = HEAP32[$2 >> 2] | 0;
 }
 __ZdlPv($77);
 STACKTOP = sp;
 return $$0 | 0;
}

function __Z19haarTransform2DFlatRNSt3__26vectorIsNS_9allocatorIsEEEEi($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0 = 0, $$03684$us = 0, $$03780$us = 0, $$03877 = 0, $$1$lcssa = 0, $$175 = 0, $$sroa$063$074 = 0, $$sroa$069$076 = 0, $10 = 0, $11 = 0, $12 = 0, $15 = 0, $17 = 0, $18 = 0, $2 = 0, $28 = 0, $29 = 0, $3 = 0, $31 = 0, $34 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $42 = 0, $43 = 0, $45 = 0, $50 = 0, $61 = 0, $63 = 0, $64 = 0, $65 = 0, $67 = 0, $68 = 0, $7 = 0, $70 = 0, $71 = 0, $77 = 0, $8 = 0, $9 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32 | 0;
 $2 = sp + 12 | 0;
 $3 = sp;
 HEAP32[$2 >> 2] = 0;
 $4 = $2 + 4 | 0;
 HEAP32[$4 >> 2] = 0;
 HEAP32[$2 + 8 >> 2] = 0;
 if (($1 | 0) > 0) {
  $7 = $3 + 4 | 0;
  $8 = $3 + 8 | 0;
  $9 = $2 + 8 | 0;
  $10 = $3 + 8 | 0;
  $$03684$us = 0;
  do {
   HEAP32[$3 >> 2] = 0;
   HEAP32[$7 >> 2] = 0;
   HEAP32[$8 >> 2] = 0;
   $11 = Math_imul($$03684$us, $1) | 0;
   $$03780$us = 0;
   $29 = 0;
   $31 = 0;
   while (1) {
    $28 = (HEAP32[$0 >> 2] | 0) + ($$03780$us + $11 << 1) | 0;
    if (($29 | 0) == ($31 | 0)) __ZNSt3__26vectorIsNS_9allocatorIsEEE21__push_back_slow_pathIRKsEEvOT_($3, $28); else {
     HEAP16[$29 >> 1] = HEAP16[$28 >> 1] | 0;
     HEAP32[$7 >> 2] = $29 + 2;
    }
    $34 = $$03780$us + 1 | 0;
    if (($34 | 0) >= ($1 | 0)) break;
    $$03780$us = $34;
    $29 = HEAP32[$7 >> 2] | 0;
    $31 = HEAP32[$10 >> 2] | 0;
   }
   $12 = HEAP32[$4 >> 2] | 0;
   if (($12 | 0) == (HEAP32[$9 >> 2] | 0)) __ZNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEE21__push_back_slow_pathIRKS3_EEvOT_($2, $3); else {
    __ZNSt3__26vectorIsNS_9allocatorIsEEEC2ERKS3_($12, $3);
    HEAP32[$4 >> 2] = (HEAP32[$4 >> 2] | 0) + 12;
   }
   $15 = HEAP32[$3 >> 2] | 0;
   $17 = $15;
   if ($15 | 0) {
    $18 = HEAP32[$7 >> 2] | 0;
    if (($18 | 0) != ($15 | 0)) HEAP32[$7 >> 2] = $18 + (~(($18 + -2 - $17 | 0) >>> 1) << 1);
    __ZdlPv($15);
   }
   $$03684$us = $$03684$us + 1 | 0;
  } while (($$03684$us | 0) < ($1 | 0));
 }
 $38 = __Z15haarTransform2DRNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEEE($2) | 0;
 $39 = HEAP32[$2 >> 2] | 0;
 if ($38) {
  $40 = HEAP32[$4 >> 2] | 0;
  if (($39 | 0) == ($40 | 0)) $$0 = 1; else {
   $42 = HEAP32[$0 >> 2] | 0;
   $$03877 = 0;
   $$sroa$069$076 = $39;
   while (1) {
    $43 = HEAP32[$$sroa$069$076 >> 2] | 0;
    $45 = HEAP32[$$sroa$069$076 + 4 >> 2] | 0;
    if (($43 | 0) == ($45 | 0)) $$1$lcssa = $$03877; else {
     $50 = ($45 + -2 - $43 | 0) >>> 1;
     $$175 = $$03877;
     $$sroa$063$074 = $43;
     while (1) {
      HEAP16[$42 + ($$175 << 1) >> 1] = HEAP16[$$sroa$063$074 >> 1] | 0;
      $$sroa$063$074 = $$sroa$063$074 + 2 | 0;
      if (($$sroa$063$074 | 0) == ($45 | 0)) break; else $$175 = $$175 + 1 | 0;
     }
     $$1$lcssa = $$03877 + 1 + $50 | 0;
    }
    $$sroa$069$076 = $$sroa$069$076 + 12 | 0;
    if (($$sroa$069$076 | 0) == ($40 | 0)) {
     $$0 = 1;
     break;
    } else $$03877 = $$1$lcssa;
   }
  }
 } else $$0 = 0;
 if (!$39) {
  STACKTOP = sp;
  return $$0 | 0;
 }
 $61 = HEAP32[$4 >> 2] | 0;
 if (($61 | 0) == ($39 | 0)) $77 = $39; else {
  $64 = $61;
  while (1) {
   $63 = $64 + -12 | 0;
   HEAP32[$4 >> 2] = $63;
   $65 = HEAP32[$63 >> 2] | 0;
   $67 = $65;
   if (!$65) $68 = $63; else {
    $70 = $64 + -8 | 0;
    $71 = HEAP32[$70 >> 2] | 0;
    if (($71 | 0) != ($65 | 0)) HEAP32[$70 >> 2] = $71 + (~(($71 + -2 - $67 | 0) >>> 1) << 1);
    __ZdlPv($65);
    $68 = HEAP32[$4 >> 2] | 0;
   }
   if (($68 | 0) == ($39 | 0)) break; else $64 = $68;
  }
  $77 = HEAP32[$2 >> 2] | 0;
 }
 __ZdlPv($77);
 STACKTOP = sp;
 return $$0 | 0;
}

function __Z15haarTransform2DRNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEEE($0) {
 $0 = $0 | 0;
 var $$04265 = 0, $$04356 = 0, $$04459 = 0, $$057 = 0, $$146 = 0, $$247 = 0, $$in = 0, $1 = 0, $12 = 0, $19 = 0, $2 = 0, $3 = 0, $30 = 0, $31 = 0, $33 = 0, $34 = 0, $36 = 0, $37 = 0, $39 = 0, $4 = 0, $48 = 0, $49 = 0, $5 = 0, $51 = 0, $52 = 0, $54 = 0, $6 = 0, $62 = 0, $64 = 0, $65 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $1 = sp;
 $2 = $0 + 4 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 $4 = HEAP32[$0 >> 2] | 0;
 $5 = $3 - $4 | 0;
 $6 = ($5 | 0) / 12 | 0;
 if (($5 | 0) == 0 | ($6 + -1 & $6 | 0) != 0) {
  $$247 = 0;
  STACKTOP = sp;
  return $$247 | 0;
 }
 if (($3 | 0) == ($4 | 0)) {
  $$247 = 1;
  STACKTOP = sp;
  return $$247 | 0;
 } else {
  $$04265 = 0;
  $$in = $4;
 }
 do {
  if (!(__Z13haarTransformRNSt3__26vectorIsNS_9allocatorIsEEEE($$in + ($$04265 * 12 | 0) | 0) | 0)) {
   $$247 = 0;
   label = 20;
   break;
  }
  $$04265 = $$04265 + 1 | 0;
  $12 = HEAP32[$2 >> 2] | 0;
  $$in = HEAP32[$0 >> 2] | 0;
 } while ($$04265 >>> 0 < (($12 - $$in | 0) / 12 | 0) >>> 0);
 if ((label | 0) == 20) {
  STACKTOP = sp;
  return $$247 | 0;
 }
 if (($12 | 0) == ($$in | 0)) {
  $$247 = 1;
  STACKTOP = sp;
  return $$247 | 0;
 }
 $19 = $1 + 4 | 0;
 $$04459 = 0;
 $30 = $$in;
 $31 = $12;
 while (1) {
  __ZNSt3__26vectorIsNS_9allocatorIsEEEC2Ej($1, ($31 - $30 | 0) / 12 | 0);
  $33 = HEAP32[$2 >> 2] | 0;
  $34 = HEAP32[$0 >> 2] | 0;
  $36 = $34;
  if (($33 | 0) != ($34 | 0)) {
   $37 = HEAP32[$1 >> 2] | 0;
   $39 = ($33 - $34 | 0) / 12 | 0;
   $$04356 = 0;
   do {
    HEAP16[$37 + ($$04356 << 1) >> 1] = HEAP16[(HEAP32[$36 + ($$04356 * 12 | 0) >> 2] | 0) + ($$04459 << 1) >> 1] | 0;
    $$04356 = $$04356 + 1 | 0;
   } while ($$04356 >>> 0 < $39 >>> 0);
  }
  if (__Z13haarTransformRNSt3__26vectorIsNS_9allocatorIsEEEE($1) | 0) {
   $48 = HEAP32[$2 >> 2] | 0;
   $49 = HEAP32[$0 >> 2] | 0;
   $51 = $49;
   if (($48 | 0) == ($49 | 0)) $$146 = 0; else {
    $52 = HEAP32[$1 >> 2] | 0;
    $54 = ($48 - $49 | 0) / 12 | 0;
    $$057 = 0;
    do {
     HEAP16[(HEAP32[$51 + ($$057 * 12 | 0) >> 2] | 0) + ($$04459 << 1) >> 1] = HEAP16[$52 + ($$057 << 1) >> 1] | 0;
     $$057 = $$057 + 1 | 0;
    } while ($$057 >>> 0 < $54 >>> 0);
    $$146 = 0;
   }
  } else $$146 = 1;
  $62 = HEAP32[$1 >> 2] | 0;
  $64 = $62;
  if ($62 | 0) {
   $65 = HEAP32[$19 >> 2] | 0;
   if (($65 | 0) != ($62 | 0)) HEAP32[$19 >> 2] = $65 + (~(($65 + -2 - $64 | 0) >>> 1) << 1);
   __ZdlPv($62);
  }
  $$04459 = $$04459 + 1 | 0;
  if ($$146 | 0) {
   $$247 = 0;
   label = 20;
   break;
  }
  $31 = HEAP32[$2 >> 2] | 0;
  $30 = HEAP32[$0 >> 2] | 0;
  if ($$04459 >>> 0 >= (($31 - $30 | 0) / 12 | 0) >>> 0) {
   $$247 = 1;
   label = 20;
   break;
  }
 }
 if ((label | 0) == 20) {
  STACKTOP = sp;
  return $$247 | 0;
 }
 return 0;
}
function _pop_arg_588($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $10 = 0, $108 = 0, $109 = 0.0, $115 = 0, $116 = 0.0, $16 = 0, $17 = 0, $20 = 0, $29 = 0, $30 = 0, $31 = 0, $40 = 0, $41 = 0, $43 = 0, $46 = 0, $47 = 0, $56 = 0, $57 = 0, $59 = 0, $62 = 0, $71 = 0, $72 = 0, $73 = 0, $82 = 0, $83 = 0, $85 = 0, $88 = 0, $9 = 0, $97 = 0, $98 = 0, $99 = 0;
 L1 : do if ($1 >>> 0 <= 20) do switch ($1 | 0) {
 case 9:
  {
   $9 = (HEAP32[$2 >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $10 = HEAP32[$9 >> 2] | 0;
   HEAP32[$2 >> 2] = $9 + 4;
   HEAP32[$0 >> 2] = $10;
   break L1;
   break;
  }
 case 10:
  {
   $16 = (HEAP32[$2 >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $17 = HEAP32[$16 >> 2] | 0;
   HEAP32[$2 >> 2] = $16 + 4;
   $20 = $0;
   HEAP32[$20 >> 2] = $17;
   HEAP32[$20 + 4 >> 2] = (($17 | 0) < 0) << 31 >> 31;
   break L1;
   break;
  }
 case 11:
  {
   $29 = (HEAP32[$2 >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $30 = HEAP32[$29 >> 2] | 0;
   HEAP32[$2 >> 2] = $29 + 4;
   $31 = $0;
   HEAP32[$31 >> 2] = $30;
   HEAP32[$31 + 4 >> 2] = 0;
   break L1;
   break;
  }
 case 12:
  {
   $40 = (HEAP32[$2 >> 2] | 0) + (8 - 1) & ~(8 - 1);
   $41 = $40;
   $43 = HEAP32[$41 >> 2] | 0;
   $46 = HEAP32[$41 + 4 >> 2] | 0;
   HEAP32[$2 >> 2] = $40 + 8;
   $47 = $0;
   HEAP32[$47 >> 2] = $43;
   HEAP32[$47 + 4 >> 2] = $46;
   break L1;
   break;
  }
 case 13:
  {
   $56 = (HEAP32[$2 >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $57 = HEAP32[$56 >> 2] | 0;
   HEAP32[$2 >> 2] = $56 + 4;
   $59 = ($57 & 65535) << 16 >> 16;
   $62 = $0;
   HEAP32[$62 >> 2] = $59;
   HEAP32[$62 + 4 >> 2] = (($59 | 0) < 0) << 31 >> 31;
   break L1;
   break;
  }
 case 14:
  {
   $71 = (HEAP32[$2 >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $72 = HEAP32[$71 >> 2] | 0;
   HEAP32[$2 >> 2] = $71 + 4;
   $73 = $0;
   HEAP32[$73 >> 2] = $72 & 65535;
   HEAP32[$73 + 4 >> 2] = 0;
   break L1;
   break;
  }
 case 15:
  {
   $82 = (HEAP32[$2 >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $83 = HEAP32[$82 >> 2] | 0;
   HEAP32[$2 >> 2] = $82 + 4;
   $85 = ($83 & 255) << 24 >> 24;
   $88 = $0;
   HEAP32[$88 >> 2] = $85;
   HEAP32[$88 + 4 >> 2] = (($85 | 0) < 0) << 31 >> 31;
   break L1;
   break;
  }
 case 16:
  {
   $97 = (HEAP32[$2 >> 2] | 0) + (4 - 1) & ~(4 - 1);
   $98 = HEAP32[$97 >> 2] | 0;
   HEAP32[$2 >> 2] = $97 + 4;
   $99 = $0;
   HEAP32[$99 >> 2] = $98 & 255;
   HEAP32[$99 + 4 >> 2] = 0;
   break L1;
   break;
  }
 case 17:
  {
   $108 = (HEAP32[$2 >> 2] | 0) + (8 - 1) & ~(8 - 1);
   $109 = +HEAPF64[$108 >> 3];
   HEAP32[$2 >> 2] = $108 + 8;
   HEAPF64[$0 >> 3] = $109;
   break L1;
   break;
  }
 case 18:
  {
   $115 = (HEAP32[$2 >> 2] | 0) + (8 - 1) & ~(8 - 1);
   $116 = +HEAPF64[$115 >> 3];
   HEAP32[$2 >> 2] = $115 + 8;
   HEAPF64[$0 >> 3] = $116;
   break L1;
   break;
  }
 default:
  break L1;
 } while (0); while (0);
 return;
}

function __Z16ihaarTransform2DRNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEEE($0) {
 $0 = $0 | 0;
 var $$04163 = 0, $$04365 = 0, $$04461 = 0, $$045 = 0, $$059 = 0, $$in72 = 0, $1 = 0, $12 = 0, $2 = 0, $21 = 0, $22 = 0, $24 = 0, $25 = 0, $27 = 0, $28 = 0, $3 = 0, $30 = 0, $39 = 0, $4 = 0, $40 = 0, $42 = 0, $43 = 0, $45 = 0, $5 = 0, $53 = 0, $55 = 0, $56 = 0, $6 = 0, $71 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $1 = sp;
 $2 = $0 + 4 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 $4 = HEAP32[$0 >> 2] | 0;
 $5 = $3 - $4 | 0;
 $6 = ($5 | 0) / 12 | 0;
 if (($5 | 0) == 0 | ($6 + -1 & $6 | 0) != 0) {
  $71 = 0;
  STACKTOP = sp;
  return $71 | 0;
 }
 if (($3 | 0) == ($4 | 0)) {
  $71 = 1;
  STACKTOP = sp;
  return $71 | 0;
 }
 $12 = $1 + 4 | 0;
 $$04365 = 0;
 $21 = $4;
 $22 = $3;
 do {
  __ZNSt3__26vectorIsNS_9allocatorIsEEEC2Ej($1, ($22 - $21 | 0) / 12 | 0);
  $24 = HEAP32[$2 >> 2] | 0;
  $25 = HEAP32[$0 >> 2] | 0;
  $27 = $25;
  if (($24 | 0) != ($25 | 0)) {
   $28 = HEAP32[$1 >> 2] | 0;
   $30 = ($24 - $25 | 0) / 12 | 0;
   $$04461 = 0;
   do {
    HEAP16[$28 + ($$04461 << 1) >> 1] = HEAP16[(HEAP32[$27 + ($$04461 * 12 | 0) >> 2] | 0) + ($$04365 << 1) >> 1] | 0;
    $$04461 = $$04461 + 1 | 0;
   } while ($$04461 >>> 0 < $30 >>> 0);
  }
  if (__Z14ihaarTransformRNSt3__26vectorIsNS_9allocatorIsEEEE($1) | 0) {
   $39 = HEAP32[$2 >> 2] | 0;
   $40 = HEAP32[$0 >> 2] | 0;
   $42 = $40;
   if (($39 | 0) == ($40 | 0)) $$045 = 0; else {
    $43 = HEAP32[$1 >> 2] | 0;
    $45 = ($39 - $40 | 0) / 12 | 0;
    $$04163 = 0;
    do {
     HEAP16[(HEAP32[$42 + ($$04163 * 12 | 0) >> 2] | 0) + ($$04365 << 1) >> 1] = HEAP16[$43 + ($$04163 << 1) >> 1] | 0;
     $$04163 = $$04163 + 1 | 0;
    } while ($$04163 >>> 0 < $45 >>> 0);
    $$045 = 0;
   }
  } else $$045 = 1;
  $53 = HEAP32[$1 >> 2] | 0;
  $55 = $53;
  if ($53 | 0) {
   $56 = HEAP32[$12 >> 2] | 0;
   if (($56 | 0) != ($53 | 0)) HEAP32[$12 >> 2] = $56 + (~(($56 + -2 - $55 | 0) >>> 1) << 1);
   __ZdlPv($53);
  }
  $$04365 = $$04365 + 1 | 0;
  if ($$045 | 0) {
   $71 = 0;
   label = 20;
   break;
  }
  $22 = HEAP32[$2 >> 2] | 0;
  $21 = HEAP32[$0 >> 2] | 0;
 } while ($$04365 >>> 0 < (($22 - $21 | 0) / 12 | 0) >>> 0);
 if ((label | 0) == 20) {
  STACKTOP = sp;
  return $71 | 0;
 }
 if (($22 | 0) == ($21 | 0)) {
  $71 = 1;
  STACKTOP = sp;
  return $71 | 0;
 } else {
  $$059 = 0;
  $$in72 = $21;
 }
 while (1) {
  if (!(__Z14ihaarTransformRNSt3__26vectorIsNS_9allocatorIsEEEE($$in72 + ($$059 * 12 | 0) | 0) | 0)) {
   $71 = 0;
   label = 20;
   break;
  }
  $$059 = $$059 + 1 | 0;
  $$in72 = HEAP32[$0 >> 2] | 0;
  if ($$059 >>> 0 >= (((HEAP32[$2 >> 2] | 0) - $$in72 | 0) / 12 | 0) >>> 0) {
   $71 = 1;
   label = 20;
   break;
  }
 }
 if ((label | 0) == 20) {
  STACKTOP = sp;
  return $71 | 0;
 }
 return 0;
}

function __tr_stored_block($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $$off0 = 0, $$off0$in = 0, $$pre$phi44Z2D = 0, $$pre$phiZ2D = 0, $12 = 0, $15 = 0, $16 = 0, $18 = 0, $23 = 0, $24 = 0, $28 = 0, $30 = 0, $35 = 0, $36 = 0, $38 = 0, $4 = 0, $43 = 0, $44 = 0, $49 = 0, $5 = 0, $50 = 0, $52 = 0, $56 = 0, $62 = 0, $67 = 0, $69 = 0, $7 = 0, $75 = 0, $9 = 0, $storemerge = 0;
 $4 = $0 + 5820 | 0;
 $5 = HEAP32[$4 >> 2] | 0;
 $7 = $3 & 65535;
 $9 = $0 + 5816 | 0;
 $12 = HEAPU16[$9 >> 1] | 0 | $7 << $5;
 HEAP16[$9 >> 1] = $12;
 if (($5 | 0) > 13) {
  $15 = $0 + 20 | 0;
  $16 = HEAP32[$15 >> 2] | 0;
  HEAP32[$15 >> 2] = $16 + 1;
  $18 = $0 + 8 | 0;
  HEAP8[(HEAP32[$18 >> 2] | 0) + $16 >> 0] = $12;
  $23 = (HEAPU16[$9 >> 1] | 0) >>> 8 & 255;
  $24 = HEAP32[$15 >> 2] | 0;
  HEAP32[$15 >> 2] = $24 + 1;
  HEAP8[(HEAP32[$18 >> 2] | 0) + $24 >> 0] = $23;
  $28 = HEAP32[$4 >> 2] | 0;
  $30 = $7 >>> (16 - $28 | 0);
  HEAP16[$9 >> 1] = $30;
  $$off0$in = $30;
  $storemerge = $28 + -13 | 0;
 } else {
  $$off0$in = $12;
  $storemerge = $5 + 3 | 0;
 }
 $$off0 = $$off0$in & 255;
 HEAP32[$4 >> 2] = $storemerge;
 do if (($storemerge | 0) > 8) {
  $35 = $0 + 20 | 0;
  $36 = HEAP32[$35 >> 2] | 0;
  HEAP32[$35 >> 2] = $36 + 1;
  $38 = $0 + 8 | 0;
  HEAP8[(HEAP32[$38 >> 2] | 0) + $36 >> 0] = $$off0;
  $43 = (HEAPU16[$9 >> 1] | 0) >>> 8 & 255;
  $44 = HEAP32[$35 >> 2] | 0;
  HEAP32[$35 >> 2] = $44 + 1;
  HEAP8[(HEAP32[$38 >> 2] | 0) + $44 >> 0] = $43;
  $$pre$phi44Z2D = $38;
  $$pre$phiZ2D = $35;
 } else {
  $49 = $0 + 20 | 0;
  if (($storemerge | 0) > 0) {
   $50 = HEAP32[$49 >> 2] | 0;
   HEAP32[$49 >> 2] = $50 + 1;
   $52 = $0 + 8 | 0;
   HEAP8[(HEAP32[$52 >> 2] | 0) + $50 >> 0] = $$off0;
   $$pre$phi44Z2D = $52;
   $$pre$phiZ2D = $49;
   break;
  } else {
   $$pre$phi44Z2D = $0 + 8 | 0;
   $$pre$phiZ2D = $49;
   break;
  }
 } while (0);
 HEAP16[$9 >> 1] = 0;
 HEAP32[$4 >> 2] = 0;
 $56 = HEAP32[$$pre$phiZ2D >> 2] | 0;
 HEAP32[$$pre$phiZ2D >> 2] = $56 + 1;
 HEAP8[(HEAP32[$$pre$phi44Z2D >> 2] | 0) + $56 >> 0] = $2;
 $62 = HEAP32[$$pre$phiZ2D >> 2] | 0;
 HEAP32[$$pre$phiZ2D >> 2] = $62 + 1;
 HEAP8[(HEAP32[$$pre$phi44Z2D >> 2] | 0) + $62 >> 0] = $2 >>> 8;
 $67 = $2 & 65535 ^ 65535;
 $69 = HEAP32[$$pre$phiZ2D >> 2] | 0;
 HEAP32[$$pre$phiZ2D >> 2] = $69 + 1;
 HEAP8[(HEAP32[$$pre$phi44Z2D >> 2] | 0) + $69 >> 0] = $67;
 $75 = HEAP32[$$pre$phiZ2D >> 2] | 0;
 HEAP32[$$pre$phiZ2D >> 2] = $75 + 1;
 HEAP8[(HEAP32[$$pre$phi44Z2D >> 2] | 0) + $75 >> 0] = $67 >>> 8;
 _memcpy((HEAP32[$$pre$phi44Z2D >> 2] | 0) + (HEAP32[$$pre$phiZ2D >> 2] | 0) | 0, $1 | 0, $2 | 0) | 0;
 HEAP32[$$pre$phiZ2D >> 2] = (HEAP32[$$pre$phiZ2D >> 2] | 0) + $2;
 return;
}

function __ZNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEE21__push_back_slow_pathIRKS3_EEvOT_($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0$i = 0, $$06$i$i = 0, $$sroa$7$0 = 0, $12 = 0, $14 = 0, $17 = 0, $2 = 0, $20 = 0, $23 = 0, $24 = 0, $25 = 0, $27 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $34 = 0, $35 = 0, $37 = 0, $4 = 0, $40 = 0, $42 = 0, $49 = 0, $50 = 0, $51 = 0, $52 = 0, $55 = 0, $56 = 0, $58 = 0, $60 = 0, $61 = 0, $7 = 0, $9 = 0, $$06$i$i$looptemp = 0, $55$looptemp = 0;
 $2 = $0 + 4 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 $4 = HEAP32[$0 >> 2] | 0;
 $7 = (($3 - $4 | 0) / 12 | 0) + 1 | 0;
 if ($7 >>> 0 > 357913941) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $9 = $0 + 8 | 0;
 $12 = ((HEAP32[$9 >> 2] | 0) - $4 | 0) / 12 | 0;
 $14 = $12 << 1;
 $$0$i = $12 >>> 0 < 178956970 ? ($14 >>> 0 < $7 >>> 0 ? $7 : $14) : 357913941;
 $17 = ($3 - $4 | 0) / 12 | 0;
 do if (!$$0$i) $24 = 0; else if ($$0$i >>> 0 > 357913941) {
  $20 = ___cxa_allocate_exception(4) | 0;
  __ZNSt9bad_allocC2Ev($20);
  ___cxa_throw($20 | 0, 424, 6);
 } else {
  $24 = __Znwj($$0$i * 12 | 0) | 0;
  break;
 } while (0);
 $23 = $24 + ($17 * 12 | 0) | 0;
 $25 = $23;
 $27 = $24 + ($$0$i * 12 | 0) | 0;
 __ZNSt3__26vectorIsNS_9allocatorIsEEEC2ERKS3_($23, $1);
 $29 = $23 + 12 | 0;
 $30 = HEAP32[$0 >> 2] | 0;
 $31 = HEAP32[$2 >> 2] | 0;
 if (($31 | 0) == ($30 | 0)) {
  $49 = $25;
  $50 = $30;
  $52 = $30;
 } else {
  $$06$i$i = $31;
  $$sroa$7$0 = $25;
  $35 = $23;
  do {
   $34 = $35 + -12 | 0;
   $$06$i$i$looptemp = $$06$i$i;
   $$06$i$i = $$06$i$i + -12 | 0;
   HEAP32[$34 >> 2] = 0;
   $37 = $35 + -8 | 0;
   HEAP32[$37 >> 2] = 0;
   HEAP32[$35 + -4 >> 2] = 0;
   HEAP32[$34 >> 2] = HEAP32[$$06$i$i >> 2];
   $40 = $$06$i$i$looptemp + -8 | 0;
   HEAP32[$37 >> 2] = HEAP32[$40 >> 2];
   $42 = $$06$i$i$looptemp + -4 | 0;
   HEAP32[$35 + -4 >> 2] = HEAP32[$42 >> 2];
   HEAP32[$42 >> 2] = 0;
   HEAP32[$40 >> 2] = 0;
   HEAP32[$$06$i$i >> 2] = 0;
   $35 = $$sroa$7$0 + -12 | 0;
   $$sroa$7$0 = $35;
  } while (($$06$i$i | 0) != ($30 | 0));
  $49 = $$sroa$7$0;
  $50 = HEAP32[$0 >> 2] | 0;
  $52 = HEAP32[$2 >> 2] | 0;
 }
 HEAP32[$0 >> 2] = $49;
 HEAP32[$2 >> 2] = $29;
 HEAP32[$9 >> 2] = $27;
 $51 = $50;
 if (($52 | 0) != ($51 | 0)) {
  $55 = $52;
  do {
   $55$looptemp = $55;
   $55 = $55 + -12 | 0;
   $56 = HEAP32[$55 >> 2] | 0;
   $58 = $56;
   if ($56 | 0) {
    $60 = $55$looptemp + -8 | 0;
    $61 = HEAP32[$60 >> 2] | 0;
    if (($61 | 0) != ($56 | 0)) HEAP32[$60 >> 2] = $61 + (~(($61 + -2 - $58 | 0) >>> 1) << 1);
    __ZdlPv($56);
   }
  } while (($55 | 0) != ($51 | 0));
 }
 if (!$50) return;
 __ZdlPv($50);
 return;
}

function __ZNSt3__26vectorIbNS_9allocatorIbEEE18__construct_at_endINS_14__bit_iteratorIS3_Lb0ELj0EEEEENS_9enable_ifIXsr21__is_forward_iteratorIT_EE5valueEvE4typeES8_S8_($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0$i$i = 0, $$sroa$0$0$$sroa$0$0$113$i$in = 0, $$sroa$7$0$i = 0, $$sroa$7$1$i = 0, $$sroa$speculated$i$i = 0, $11 = 0, $12 = 0, $14 = 0, $16 = 0, $22 = 0, $23 = 0, $24 = 0, $27 = 0, $29 = 0, $3 = 0, $32 = 0, $38 = 0, $4 = 0, $45 = 0, $49 = 0, $5 = 0, $50 = 0, $52 = 0, $54 = 0, $55 = 0, $57 = 0, $59 = 0, $6 = 0, $61 = 0, $68 = 0, $7 = 0, $8 = 0, $9 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32 | 0;
 $3 = sp + 24 | 0;
 $4 = sp + 16 | 0;
 $5 = sp + 8 | 0;
 $6 = sp;
 $7 = $0 + 4 | 0;
 $8 = HEAP32[$7 >> 2] | 0;
 $9 = HEAP32[$1 >> 2] | 0;
 $11 = HEAP32[$1 + 4 >> 2] | 0;
 $12 = HEAP32[$2 >> 2] | 0;
 $14 = HEAP32[$2 + 4 >> 2] | 0;
 $16 = $12 - $9 << 3;
 HEAP32[$7 >> 2] = $8 - $11 + $14 + $16;
 $22 = (HEAP32[$0 >> 2] | 0) + ($8 >>> 5 << 2) | 0;
 $23 = $8 & 31;
 $24 = $22;
 if (($11 | 0) != ($23 | 0)) {
  HEAP32[$3 >> 2] = $9;
  HEAP32[$3 + 4 >> 2] = $11;
  HEAP32[$4 >> 2] = $12;
  HEAP32[$4 + 4 >> 2] = $14;
  HEAP32[$5 >> 2] = $24;
  HEAP32[$5 + 4 >> 2] = $23;
  __ZNSt3__216__copy_unalignedINS_6vectorIbNS_9allocatorIbEEEELb0EEENS_14__bit_iteratorIT_Lb0EXLi0EEEENS5_IS6_XT0_EXLi0EEEES8_S7_($6, $3, $4, $5);
  STACKTOP = sp;
  return;
 }
 $27 = $14 - $11 + $16 | 0;
 $29 = $9;
 if (($27 | 0) > 0) {
  if (!$11) {
   $$0$i$i = $27;
   $$sroa$0$0$$sroa$0$0$113$i$in = $22;
   $$sroa$7$0$i = 0;
   $52 = $9;
   $59 = $29;
  } else {
   $32 = 32 - $11 | 0;
   $$sroa$speculated$i$i = ($27 | 0) < ($32 | 0) ? $27 : $32;
   $38 = -1 >>> ($32 - $$sroa$speculated$i$i | 0) & -1 << $11;
   HEAP32[$22 >> 2] = HEAP32[$22 >> 2] & ~$38 | HEAP32[$29 >> 2] & $38;
   $45 = $$sroa$speculated$i$i + $11 | 0;
   $49 = $29 + 4 | 0;
   $$0$i$i = $27 - $$sroa$speculated$i$i | 0;
   $$sroa$0$0$$sroa$0$0$113$i$in = $22 + ($45 >>> 5 << 2) | 0;
   $$sroa$7$0$i = $45 & 31;
   $52 = $49;
   $59 = $49;
  }
  $50 = $$0$i$i >>> 5;
  _memmove($$sroa$0$0$$sroa$0$0$113$i$in | 0, $52 | 0, $50 << 2 | 0) | 0;
  $54 = $$0$i$i - ($50 << 5) | 0;
  $55 = $$sroa$0$0$$sroa$0$0$113$i$in + ($50 << 2) | 0;
  $57 = $55;
  if (($54 | 0) > 0) {
   $61 = -1 >>> (32 - $54 | 0);
   HEAP32[$55 >> 2] = HEAP32[$55 >> 2] & ~$61 | HEAP32[$59 + ($50 << 2) >> 2] & $61;
   $$sroa$7$1$i = $54;
   $68 = $57;
  } else {
   $$sroa$7$1$i = $$sroa$7$0$i;
   $68 = $57;
  }
 } else {
  $$sroa$7$1$i = $11;
  $68 = $24;
 }
 HEAP32[$6 >> 2] = $68;
 HEAP32[$6 + 4 >> 2] = $$sroa$7$1$i;
 STACKTOP = sp;
 return;
}

function _memchr($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0$lcssa = 0, $$035$lcssa = 0, $$035$lcssa65 = 0, $$03555 = 0, $$036$lcssa = 0, $$036$lcssa64 = 0, $$03654 = 0, $$046 = 0, $$137$lcssa = 0, $$13745 = 0, $$140 = 0, $$2 = 0, $$23839 = 0, $$3 = 0, $$lcssa = 0, $11 = 0, $12 = 0, $16 = 0, $18 = 0, $20 = 0, $23 = 0, $29 = 0, $3 = 0, $30 = 0, $35 = 0, $7 = 0, $8 = 0, label = 0;
 $3 = $1 & 255;
 $7 = ($2 | 0) != 0;
 L1 : do if ($7 & ($0 & 3 | 0) != 0) {
  $8 = $1 & 255;
  $$03555 = $0;
  $$03654 = $2;
  while (1) {
   if ((HEAP8[$$03555 >> 0] | 0) == $8 << 24 >> 24) {
    $$035$lcssa65 = $$03555;
    $$036$lcssa64 = $$03654;
    label = 6;
    break L1;
   }
   $11 = $$03555 + 1 | 0;
   $12 = $$03654 + -1 | 0;
   $16 = ($12 | 0) != 0;
   if ($16 & ($11 & 3 | 0) != 0) {
    $$03555 = $11;
    $$03654 = $12;
   } else {
    $$035$lcssa = $11;
    $$036$lcssa = $12;
    $$lcssa = $16;
    label = 5;
    break;
   }
  }
 } else {
  $$035$lcssa = $0;
  $$036$lcssa = $2;
  $$lcssa = $7;
  label = 5;
 } while (0);
 if ((label | 0) == 5) if ($$lcssa) {
  $$035$lcssa65 = $$035$lcssa;
  $$036$lcssa64 = $$036$lcssa;
  label = 6;
 } else {
  $$2 = $$035$lcssa;
  $$3 = 0;
 }
 L8 : do if ((label | 0) == 6) {
  $18 = $1 & 255;
  if ((HEAP8[$$035$lcssa65 >> 0] | 0) == $18 << 24 >> 24) {
   $$2 = $$035$lcssa65;
   $$3 = $$036$lcssa64;
  } else {
   $20 = Math_imul($3, 16843009) | 0;
   L11 : do if ($$036$lcssa64 >>> 0 > 3) {
    $$046 = $$035$lcssa65;
    $$13745 = $$036$lcssa64;
    while (1) {
     $23 = HEAP32[$$046 >> 2] ^ $20;
     if (($23 & -2139062144 ^ -2139062144) & $23 + -16843009 | 0) break;
     $29 = $$046 + 4 | 0;
     $30 = $$13745 + -4 | 0;
     if ($30 >>> 0 > 3) {
      $$046 = $29;
      $$13745 = $30;
     } else {
      $$0$lcssa = $29;
      $$137$lcssa = $30;
      label = 11;
      break L11;
     }
    }
    $$140 = $$046;
    $$23839 = $$13745;
   } else {
    $$0$lcssa = $$035$lcssa65;
    $$137$lcssa = $$036$lcssa64;
    label = 11;
   } while (0);
   if ((label | 0) == 11) if (!$$137$lcssa) {
    $$2 = $$0$lcssa;
    $$3 = 0;
    break;
   } else {
    $$140 = $$0$lcssa;
    $$23839 = $$137$lcssa;
   }
   while (1) {
    if ((HEAP8[$$140 >> 0] | 0) == $18 << 24 >> 24) {
     $$2 = $$140;
     $$3 = $$23839;
     break L8;
    }
    $35 = $$140 + 1 | 0;
    $$23839 = $$23839 + -1 | 0;
    if (!$$23839) {
     $$2 = $35;
     $$3 = 0;
     break;
    } else $$140 = $35;
   }
  }
 } while (0);
 return ($$3 | 0 ? $$2 : 0) | 0;
}

function __Z10threshold2RNSt3__26vectorIsNS_9allocatorIsEEEEi($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0102$us$us = 0, $$065$in$us$us = 0, $$066$in$us$us = 0, $$068104$us$us = 0, $$074107 = 0, $$074109$us = 0, $$075108$us = 0, $$176$lcssa$us = 0, $$176103$us$us = 0, $$277101$us$us = 0, $$378$us$us = 0, $$473 = 0, $10 = 0, $13 = 0, $2 = 0, $20 = 0, $22 = 0, $27 = 0, $28 = 0, $3 = 0, $30 = 0, $32 = 0, $4 = 0, $7 = 0, label = 0;
 $2 = HEAP32[$0 >> 2] | 0;
 $3 = HEAP16[$2 >> 1] | 0;
 $4 = $3 << 16 >> 16;
 $7 = HEAP16[$2 + 2 >> 1] | 0;
 $$074107 = $7 + -1 | 0;
 if (($$074107 | 0) == 0 | $3 << 16 >> 16 == 0) {
  $$473 = 0;
  return $$473 | 0;
 } else {
  $$074109$us = $$074107;
  $$075108$us = 0;
 }
 L3 : while (1) {
  $10 = $$074109$us << 1;
  if (!$10) $$176$lcssa$us = $$075108$us; else {
   $$068104$us$us = 0;
   $$176103$us$us = $$075108$us;
   while (1) {
    $13 = $$068104$us$us >>> 1;
    if (!($$068104$us$us & 1)) {
     $$065$in$us$us = $$074109$us;
     $$066$in$us$us = $$074109$us - ($13 << 16 >> 16) | 0;
    } else {
     $$065$in$us$us = $$074109$us - ($13 & 65535) | 0;
     $$066$in$us$us = $$074109$us;
    }
    $20 = $$065$in$us$us << 16 >> 16;
    $22 = ($$066$in$us$us << 16 >> 16) + 2 | 0;
    $$0102$us$us = 0;
    $$277101$us$us = $$176103$us$us;
    while (1) {
     $27 = $2 + ($22 + (Math_imul((Math_imul($$0102$us$us, $7) | 0) + $20 | 0, $7) | 0) << 1) | 0;
     $28 = HEAP16[$27 >> 1] | 0;
     if (!($28 << 16 >> 16)) $$378$us$us = $$277101$us$us; else {
      $30 = $28 << 16 >> 16;
      $32 = ($28 << 16 >> 16 > -1 ? $30 : 0 - $30 | 0) + $$277101$us$us | 0;
      HEAP16[$27 >> 1] = 0;
      if (($32 | 0) < ($1 | 0)) $$378$us$us = $32; else {
       $$473 = $32;
       label = 12;
       break L3;
      }
     }
     $$0102$us$us = $$0102$us$us + 1 | 0;
     if ($$0102$us$us >>> 0 >= $4 >>> 0) break; else $$277101$us$us = $$378$us$us;
    }
    $$068104$us$us = $$068104$us$us + 1 | 0;
    if ($$068104$us$us >>> 0 >= $10 >>> 0) {
     $$176$lcssa$us = $$378$us$us;
     break;
    } else $$176103$us$us = $$378$us$us;
   }
  }
  $$074109$us = $$074109$us + -1 | 0;
  if (!$$074109$us) {
   $$473 = $$176$lcssa$us;
   label = 12;
   break;
  } else $$075108$us = $$176$lcssa$us;
 }
 if ((label | 0) == 12) return $$473 | 0;
 return 0;
}

function ___mo_lookup($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$$i = 0, $$$i105 = 0, $$$i106 = 0, $$$i107 = 0, $$$i108 = 0, $$$i109 = 0, $$$i110 = 0, $$090 = 0, $$094 = 0, $$4 = 0, $10 = 0, $12 = 0, $13 = 0, $17 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $30 = 0, $31 = 0, $34 = 0, $35 = 0, $44 = 0, $46 = 0, $48 = 0, $49 = 0, $5 = 0, $52 = 0, $53 = 0, $6 = 0, $64 = 0, $7 = 0, $9 = 0;
 $5 = HEAP32[$0 + 8 >> 2] | 0;
 $6 = (HEAP32[$0 >> 2] | 0) == -1794895138;
 $7 = _llvm_bswap_i32($5 | 0) | 0;
 $$$i = $6 ? $5 : $7;
 $9 = HEAP32[$0 + 12 >> 2] | 0;
 $10 = _llvm_bswap_i32($9 | 0) | 0;
 $$$i110 = $6 ? $9 : $10;
 $12 = HEAP32[$0 + 16 >> 2] | 0;
 $13 = _llvm_bswap_i32($12 | 0) | 0;
 $$$i109 = $6 ? $12 : $13;
 L1 : do if ($$$i >>> 0 < $1 >>> 2 >>> 0) {
  $17 = $1 - ($$$i << 2) | 0;
  if ($$$i110 >>> 0 < $17 >>> 0 & $$$i109 >>> 0 < $17 >>> 0) if (!(($$$i109 | $$$i110) & 3)) {
   $23 = $$$i110 >>> 2;
   $24 = $$$i109 >>> 2;
   $$090 = 0;
   $$094 = $$$i;
   while (1) {
    $25 = $$094 >>> 1;
    $26 = $$090 + $25 | 0;
    $27 = $26 << 1;
    $28 = $27 + $23 | 0;
    $30 = HEAP32[$0 + ($28 << 2) >> 2] | 0;
    $31 = _llvm_bswap_i32($30 | 0) | 0;
    $$$i108 = $6 ? $30 : $31;
    $34 = HEAP32[$0 + ($28 + 1 << 2) >> 2] | 0;
    $35 = _llvm_bswap_i32($34 | 0) | 0;
    $$$i107 = $6 ? $34 : $35;
    if (!($$$i107 >>> 0 < $1 >>> 0 & $$$i108 >>> 0 < ($1 - $$$i107 | 0) >>> 0)) {
     $$4 = 0;
     break L1;
    }
    if (HEAP8[$0 + ($$$i107 + $$$i108) >> 0] | 0) {
     $$4 = 0;
     break L1;
    }
    $44 = _strcmp($2, $0 + $$$i107 | 0) | 0;
    if (!$44) break;
    if (($$094 | 0) == 1) {
     $$4 = 0;
     break L1;
    }
    $64 = ($44 | 0) < 0;
    $$090 = $64 ? $$090 : $26;
    $$094 = $64 ? $25 : $$094 - $25 | 0;
   }
   $46 = $27 + $24 | 0;
   $48 = HEAP32[$0 + ($46 << 2) >> 2] | 0;
   $49 = _llvm_bswap_i32($48 | 0) | 0;
   $$$i106 = $6 ? $48 : $49;
   $52 = HEAP32[$0 + ($46 + 1 << 2) >> 2] | 0;
   $53 = _llvm_bswap_i32($52 | 0) | 0;
   $$$i105 = $6 ? $52 : $53;
   if ($$$i105 >>> 0 < $1 >>> 0 & $$$i106 >>> 0 < ($1 - $$$i105 | 0) >>> 0) $$4 = (HEAP8[$0 + ($$$i105 + $$$i106) >> 0] | 0) == 0 ? $0 + $$$i105 | 0 : 0; else $$4 = 0;
  } else $$4 = 0; else $$4 = 0;
 } else $$4 = 0; while (0);
 return $$4 | 0;
}

function __tr_align($0) {
 $0 = $0 | 0;
 var $$off0 = 0, $$off0$in = 0, $$off049 = 0, $1 = 0, $11 = 0, $12 = 0, $14 = 0, $19 = 0, $2 = 0, $20 = 0, $24 = 0, $26 = 0, $31 = 0, $32 = 0, $34 = 0, $39 = 0, $40 = 0, $48 = 0, $49 = 0, $5 = 0, $51 = 0, $56 = 0, $57 = 0, $62 = 0, $63 = 0, $8 = 0, $storemerge = 0, $storemerge47 = 0;
 $1 = $0 + 5820 | 0;
 $2 = HEAP32[$1 >> 2] | 0;
 $5 = $0 + 5816 | 0;
 $8 = HEAPU16[$5 >> 1] | 0 | 2 << $2;
 HEAP16[$5 >> 1] = $8;
 if (($2 | 0) > 13) {
  $11 = $0 + 20 | 0;
  $12 = HEAP32[$11 >> 2] | 0;
  HEAP32[$11 >> 2] = $12 + 1;
  $14 = $0 + 8 | 0;
  HEAP8[(HEAP32[$14 >> 2] | 0) + $12 >> 0] = $8;
  $19 = (HEAPU16[$5 >> 1] | 0) >>> 8 & 255;
  $20 = HEAP32[$11 >> 2] | 0;
  HEAP32[$11 >> 2] = $20 + 1;
  HEAP8[(HEAP32[$14 >> 2] | 0) + $20 >> 0] = $19;
  $24 = HEAP32[$1 >> 2] | 0;
  $26 = 2 >>> (16 - $24 | 0);
  HEAP16[$5 >> 1] = $26;
  $$off0$in = $26;
  $storemerge = $24 + -13 | 0;
 } else {
  $$off0$in = $8;
  $storemerge = $2 + 3 | 0;
 }
 $$off0 = $$off0$in & 255;
 HEAP32[$1 >> 2] = $storemerge;
 if (($storemerge | 0) > 9) {
  $31 = $0 + 20 | 0;
  $32 = HEAP32[$31 >> 2] | 0;
  HEAP32[$31 >> 2] = $32 + 1;
  $34 = $0 + 8 | 0;
  HEAP8[(HEAP32[$34 >> 2] | 0) + $32 >> 0] = $$off0;
  $39 = (HEAPU16[$5 >> 1] | 0) >>> 8 & 255;
  $40 = HEAP32[$31 >> 2] | 0;
  HEAP32[$31 >> 2] = $40 + 1;
  HEAP8[(HEAP32[$34 >> 2] | 0) + $40 >> 0] = $39;
  HEAP16[$5 >> 1] = 0;
  $$off049 = 0;
  $storemerge47 = (HEAP32[$1 >> 2] | 0) + -9 | 0;
 } else {
  $$off049 = $$off0;
  $storemerge47 = $storemerge + 7 | 0;
 }
 HEAP32[$1 >> 2] = $storemerge47;
 if (($storemerge47 | 0) == 16) {
  $48 = $0 + 20 | 0;
  $49 = HEAP32[$48 >> 2] | 0;
  HEAP32[$48 >> 2] = $49 + 1;
  $51 = $0 + 8 | 0;
  HEAP8[(HEAP32[$51 >> 2] | 0) + $49 >> 0] = $$off049;
  $56 = (HEAPU16[$5 >> 1] | 0) >>> 8 & 255;
  $57 = HEAP32[$48 >> 2] | 0;
  HEAP32[$48 >> 2] = $57 + 1;
  HEAP8[(HEAP32[$51 >> 2] | 0) + $57 >> 0] = $56;
  HEAP16[$5 >> 1] = 0;
  HEAP32[$1 >> 2] = 0;
  return;
 }
 if (($storemerge47 | 0) <= 7) return;
 $62 = $0 + 20 | 0;
 $63 = HEAP32[$62 >> 2] | 0;
 HEAP32[$62 >> 2] = $63 + 1;
 HEAP8[(HEAP32[$0 + 8 >> 2] | 0) + $63 >> 0] = $$off049;
 HEAP16[$5 >> 1] = (HEAPU16[$5 >> 1] | 0) >>> 8;
 HEAP32[$1 >> 2] = (HEAP32[$1 >> 2] | 0) + -8;
 return;
}

function ___stdio_write($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0 = 0, $$04756 = 0, $$04855 = 0, $$04954 = 0, $$051 = 0, $$1 = 0, $$150 = 0, $12 = 0, $13 = 0, $17 = 0, $20 = 0, $25 = 0, $26 = 0, $3 = 0, $37 = 0, $38 = 0, $4 = 0, $44 = 0, $5 = 0, $7 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48 | 0;
 $vararg_buffer3 = sp + 16 | 0;
 $vararg_buffer = sp;
 $3 = sp + 32 | 0;
 $4 = $0 + 28 | 0;
 $5 = HEAP32[$4 >> 2] | 0;
 HEAP32[$3 >> 2] = $5;
 $7 = $0 + 20 | 0;
 $9 = (HEAP32[$7 >> 2] | 0) - $5 | 0;
 HEAP32[$3 + 4 >> 2] = $9;
 HEAP32[$3 + 8 >> 2] = $1;
 HEAP32[$3 + 12 >> 2] = $2;
 $12 = $9 + $2 | 0;
 $13 = $0 + 60 | 0;
 HEAP32[$vararg_buffer >> 2] = HEAP32[$13 >> 2];
 HEAP32[$vararg_buffer + 4 >> 2] = $3;
 HEAP32[$vararg_buffer + 8 >> 2] = 2;
 $17 = ___syscall_ret(___syscall146(146, $vararg_buffer | 0) | 0) | 0;
 L1 : do if (($12 | 0) == ($17 | 0)) label = 3; else {
  $$04756 = 2;
  $$04855 = $12;
  $$04954 = $3;
  $26 = $17;
  while (1) {
   if (($26 | 0) < 0) break;
   $$04855 = $$04855 - $26 | 0;
   $37 = HEAP32[$$04954 + 4 >> 2] | 0;
   $38 = $26 >>> 0 > $37 >>> 0;
   $$150 = $38 ? $$04954 + 8 | 0 : $$04954;
   $$1 = ($38 << 31 >> 31) + $$04756 | 0;
   $$0 = $26 - ($38 ? $37 : 0) | 0;
   HEAP32[$$150 >> 2] = (HEAP32[$$150 >> 2] | 0) + $$0;
   $44 = $$150 + 4 | 0;
   HEAP32[$44 >> 2] = (HEAP32[$44 >> 2] | 0) - $$0;
   HEAP32[$vararg_buffer3 >> 2] = HEAP32[$13 >> 2];
   HEAP32[$vararg_buffer3 + 4 >> 2] = $$150;
   HEAP32[$vararg_buffer3 + 8 >> 2] = $$1;
   $26 = ___syscall_ret(___syscall146(146, $vararg_buffer3 | 0) | 0) | 0;
   if (($$04855 | 0) == ($26 | 0)) {
    label = 3;
    break L1;
   } else {
    $$04756 = $$1;
    $$04954 = $$150;
   }
  }
  HEAP32[$0 + 16 >> 2] = 0;
  HEAP32[$4 >> 2] = 0;
  HEAP32[$7 >> 2] = 0;
  HEAP32[$0 >> 2] = HEAP32[$0 >> 2] | 32;
  if (($$04756 | 0) == 2) $$051 = 0; else $$051 = $2 - (HEAP32[$$04954 + 4 >> 2] | 0) | 0;
 } while (0);
 if ((label | 0) == 3) {
  $20 = HEAP32[$0 + 44 >> 2] | 0;
  HEAP32[$0 + 16 >> 2] = $20 + (HEAP32[$0 + 48 >> 2] | 0);
  $25 = $20;
  HEAP32[$4 >> 2] = $25;
  HEAP32[$7 >> 2] = $25;
  $$051 = $2;
 }
 STACKTOP = sp;
 return $$051 | 0;
}

function __Z11compressVecRNSt3__26vectorIbNS_9allocatorIbEEEE($0) {
 $0 = $0 | 0;
 var $$0$i$i$i = 0, $$037 = 0, $1 = 0, $12 = 0, $13 = 0, $14 = 0, $18 = 0, $2 = 0, $22 = 0, $23 = 0, $25 = 0, $26 = 0, $3 = 0, $30 = 0, $32 = 0, $34 = 0, $35 = 0, $37 = 0, $39 = 0, $42 = 0, $43 = 0, $50 = 0, $54 = 0, $7 = 0, $8 = 0, $9 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $1 = sp;
 $2 = __Z8vecToRawRNSt3__26vectorIbNS_9allocatorIbEEEE($0) | 0;
 $3 = $2 + 4 | 0;
 $7 = _compressBound((HEAP32[$3 >> 2] | 0) - (HEAP32[$2 >> 2] | 0) | 0) | 0;
 HEAP32[$1 >> 2] = $7;
 $8 = _malloc($7) | 0;
 $9 = HEAP32[$2 >> 2] | 0;
 _compress($8, $1, $9, (HEAP32[$3 >> 2] | 0) - $9 | 0) | 0;
 $12 = __Znwj(12) | 0;
 HEAP32[$12 >> 2] = 0;
 $13 = $12 + 4 | 0;
 HEAP32[$13 >> 2] = 0;
 $14 = $12 + 8 | 0;
 HEAP32[$14 >> 2] = 0;
 L1 : do if (HEAP32[$1 >> 2] | 0) {
  $$037 = 0;
  $23 = 0;
  $25 = 0;
  while (1) {
   $22 = $8 + $$037 | 0;
   $26 = $23;
   if (($23 | 0) == ($25 | 0)) {
    $30 = HEAP32[$12 >> 2] | 0;
    $32 = $26 - $30 + 1 | 0;
    if (($32 | 0) < 0) break;
    $34 = $30;
    $35 = $26 - $30 | 0;
    $37 = $35 << 1;
    $$0$i$i$i = $35 >>> 0 < 1073741823 ? ($37 >>> 0 < $32 >>> 0 ? $32 : $37) : 2147483647;
    $39 = $26 - $30 | 0;
    if (!$$0$i$i$i) $43 = 0; else $43 = __Znwj($$0$i$i$i) | 0;
    $42 = $43 + $39 | 0;
    HEAP8[$42 >> 0] = HEAP8[$22 >> 0] | 0;
    $50 = $42 + (0 - $39) | 0;
    if (($39 | 0) > 0) _memcpy($50 | 0, $34 | 0, $39 | 0) | 0;
    HEAP32[$12 >> 2] = $50;
    HEAP32[$13 >> 2] = $42 + 1;
    HEAP32[$14 >> 2] = $43 + $$0$i$i$i;
    if ($30 | 0) __ZdlPv($34);
   } else {
    HEAP8[$23 >> 0] = HEAP8[$22 >> 0] | 0;
    HEAP32[$13 >> 2] = (HEAP32[$13 >> 2] | 0) + 1;
   }
   $54 = $$037 + 1 | 0;
   if ($54 >>> 0 >= (HEAP32[$1 >> 2] | 0) >>> 0) break L1;
   $$037 = $54;
   $23 = HEAP32[$13 >> 2] | 0;
   $25 = HEAP32[$14 >> 2] | 0;
  }
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($12);
 } while (0);
 _free($8);
 if (!$2) {
  STACKTOP = sp;
  return $12 | 0;
 }
 $18 = HEAP32[$2 >> 2] | 0;
 if ($18 | 0) {
  if ((HEAP32[$3 >> 2] | 0) != ($18 | 0)) HEAP32[$3 >> 2] = $18;
  __ZdlPv($18);
 }
 __ZdlPv($2);
 STACKTOP = sp;
 return $12 | 0;
}

function __Z15calculateImpactj($0) {
 $0 = $0 | 0;
 var $$0$i$us$us = 0.0, $$0$i$us31 = 0.0, $$02128$us = 0, $$027$us$us = 0, $$027$us29 = 0, $$pre = 0, $1 = 0, $10 = 0, $12 = 0, $14 = 0, $16 = 0, $18 = 0, $2 = 0, $22 = 0.0, $25 = 0, $27 = 0, $29 = 0, $3 = 0, $31 = 0, $33 = 0, $4 = 0, $45 = 0, $47 = 0, $49 = 0, $51 = 0, $53 = 0, $62 = 0, $63 = 0, $8 = 0;
 $1 = __Znwj(12) | 0;
 $2 = Math_imul($0, $0) | 0;
 HEAP32[$1 >> 2] = 0;
 $3 = $1 + 4 | 0;
 HEAP32[$3 >> 2] = 0;
 $4 = $1 + 8 | 0;
 HEAP32[$4 >> 2] = 0;
 do if ($2 | 0) if ($2 >>> 0 > 1073741823) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($1); else {
  $62 = $2 << 2;
  $63 = __Znwj($62) | 0;
  HEAP32[$1 >> 2] = $63;
  HEAP32[$4 >> 2] = $63 + ($2 << 2);
  _memset($63 | 0, 0, $62 | 0) | 0;
  HEAP32[$3 >> 2] = $63 + ($2 << 2);
  break;
 } while (0);
 if (!$0) return $1 | 0;
 $$pre = HEAP32[$1 >> 2] | 0;
 $$02128$us = 0;
 do {
  $8 = Math_imul($$02128$us, $0) | 0;
  $10 = $$02128$us >>> 1 | $$02128$us;
  $12 = $10 >>> 2 | $10;
  $14 = $12 >>> 4 | $12;
  $16 = $14 >>> 8 | $14;
  $18 = $16 >>> 16 | $16;
  $22 = 1.0 / +(($18 - ($18 >>> 1) | 0) >>> 0);
  if (!$$02128$us) {
   $$027$us$us = 0;
   do {
    if (!$$027$us$us) $$0$i$us$us = 1.0; else {
     $45 = $$027$us$us >>> 1 | $$027$us$us;
     $47 = $45 >>> 2 | $45;
     $49 = $47 >>> 4 | $47;
     $51 = $49 >>> 8 | $49;
     $53 = $51 >>> 16 | $51;
     $$0$i$us$us = 1.0 / +(($53 - ($53 >>> 1) | 0) >>> 0);
    }
    HEAPF32[$$pre + ($$027$us$us + $8 << 2) >> 2] = $$0$i$us$us;
    $$027$us$us = $$027$us$us + 1 | 0;
   } while (($$027$us$us | 0) != ($0 | 0));
  } else {
   $$027$us29 = 0;
   do {
    if (!$$027$us29) $$0$i$us31 = 1.0; else {
     $25 = $$027$us29 >>> 1 | $$027$us29;
     $27 = $25 >>> 2 | $25;
     $29 = $27 >>> 4 | $27;
     $31 = $29 >>> 8 | $29;
     $33 = $31 >>> 16 | $31;
     $$0$i$us31 = 1.0 / +(($33 - ($33 >>> 1) | 0) >>> 0);
    }
    HEAPF32[$$pre + ($$027$us29 + $8 << 2) >> 2] = $$0$i$us31 * $22;
    $$027$us29 = $$027$us29 + 1 | 0;
   } while (($$027$us29 | 0) != ($0 | 0));
  }
  $$02128$us = $$02128$us + 1 | 0;
 } while (($$02128$us | 0) != ($0 | 0));
 return $1 | 0;
}

function _memcpy(dest, src, num) {
 dest = dest | 0;
 src = src | 0;
 num = num | 0;
 var ret = 0, aligned_dest_end = 0, block_aligned_dest_end = 0, dest_end = 0;
 if ((num | 0) >= 8192) return _emscripten_memcpy_big(dest | 0, src | 0, num | 0) | 0;
 ret = dest | 0;
 dest_end = dest + num | 0;
 if ((dest & 3) == (src & 3)) {
  while (dest & 3) {
   if (!num) return ret | 0;
   HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
   dest = dest + 1 | 0;
   src = src + 1 | 0;
   num = num - 1 | 0;
  }
  aligned_dest_end = dest_end & -4 | 0;
  block_aligned_dest_end = aligned_dest_end - 64 | 0;
  while ((dest | 0) <= (block_aligned_dest_end | 0)) {
   HEAP32[dest >> 2] = HEAP32[src >> 2];
   HEAP32[dest + 4 >> 2] = HEAP32[src + 4 >> 2];
   HEAP32[dest + 8 >> 2] = HEAP32[src + 8 >> 2];
   HEAP32[dest + 12 >> 2] = HEAP32[src + 12 >> 2];
   HEAP32[dest + 16 >> 2] = HEAP32[src + 16 >> 2];
   HEAP32[dest + 20 >> 2] = HEAP32[src + 20 >> 2];
   HEAP32[dest + 24 >> 2] = HEAP32[src + 24 >> 2];
   HEAP32[dest + 28 >> 2] = HEAP32[src + 28 >> 2];
   HEAP32[dest + 32 >> 2] = HEAP32[src + 32 >> 2];
   HEAP32[dest + 36 >> 2] = HEAP32[src + 36 >> 2];
   HEAP32[dest + 40 >> 2] = HEAP32[src + 40 >> 2];
   HEAP32[dest + 44 >> 2] = HEAP32[src + 44 >> 2];
   HEAP32[dest + 48 >> 2] = HEAP32[src + 48 >> 2];
   HEAP32[dest + 52 >> 2] = HEAP32[src + 52 >> 2];
   HEAP32[dest + 56 >> 2] = HEAP32[src + 56 >> 2];
   HEAP32[dest + 60 >> 2] = HEAP32[src + 60 >> 2];
   dest = dest + 64 | 0;
   src = src + 64 | 0;
  }
  while ((dest | 0) < (aligned_dest_end | 0)) {
   HEAP32[dest >> 2] = HEAP32[src >> 2];
   dest = dest + 4 | 0;
   src = src + 4 | 0;
  }
 } else {
  aligned_dest_end = dest_end - 4 | 0;
  while ((dest | 0) < (aligned_dest_end | 0)) {
   HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
   HEAP8[dest + 1 >> 0] = HEAP8[src + 1 >> 0] | 0;
   HEAP8[dest + 2 >> 0] = HEAP8[src + 2 >> 0] | 0;
   HEAP8[dest + 3 >> 0] = HEAP8[src + 3 >> 0] | 0;
   dest = dest + 4 | 0;
   src = src + 4 | 0;
  }
 }
 while ((dest | 0) < (dest_end | 0)) {
  HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
  dest = dest + 1 | 0;
  src = src + 1 | 0;
 }
 return ret | 0;
}

function __ZNSt3__26vectorIsNS_9allocatorIsEEE6assignIPsEENS_9enable_ifIXaasr21__is_forward_iteratorIT_EE5valuesr16is_constructibleIsNS_15iterator_traitsIS7_E9referenceEEE5valueEvE4typeES7_S7_($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$ = 0, $$0$i = 0, $13 = 0, $14 = 0, $17 = 0, $18 = 0, $20 = 0, $21 = 0, $22 = 0, $25 = 0, $26 = 0, $3 = 0, $32 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $49 = 0, $5 = 0, $50 = 0, $56 = 0, $57 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 $3 = $2;
 $4 = $1;
 $5 = $3 - $4 | 0;
 $6 = $5 >> 1;
 $7 = $0 + 8 | 0;
 $8 = HEAP32[$7 >> 2] | 0;
 $9 = HEAP32[$0 >> 2] | 0;
 $13 = $9;
 if ($6 >>> 0 <= $8 - $9 >> 1 >>> 0) {
  $14 = $0 + 4 | 0;
  $17 = (HEAP32[$14 >> 2] | 0) - $9 >> 1;
  $18 = $6 >>> 0 > $17 >>> 0;
  $$ = $18 ? $1 + ($17 << 1) | 0 : $2;
  $20 = $$;
  $21 = $20 - $4 | 0;
  $22 = $21 >> 1;
  if ($22 | 0) _memmove($9 | 0, $1 | 0, $21 | 0) | 0;
  $25 = $13 + ($22 << 1) | 0;
  if ($18) {
   $26 = $3 - $20 | 0;
   if (($26 | 0) <= 0) return;
   _memcpy(HEAP32[$14 >> 2] | 0, $$ | 0, $26 | 0) | 0;
   HEAP32[$14 >> 2] = (HEAP32[$14 >> 2] | 0) + ($26 >> 1 << 1);
   return;
  } else {
   $32 = HEAP32[$14 >> 2] | 0;
   if (($32 | 0) == ($25 | 0)) return;
   HEAP32[$14 >> 2] = $32 + (~(($32 + -2 - $25 | 0) >>> 1) << 1);
   return;
  }
 }
 $40 = $9;
 if (!$9) $50 = $8; else {
  $41 = $0 + 4 | 0;
  $42 = HEAP32[$41 >> 2] | 0;
  if (($42 | 0) != ($13 | 0)) HEAP32[$41 >> 2] = $42 + (~(($42 + -2 - $9 | 0) >>> 1) << 1);
  __ZdlPv($40);
  HEAP32[$7 >> 2] = 0;
  HEAP32[$41 >> 2] = 0;
  HEAP32[$0 >> 2] = 0;
  $50 = 0;
 }
 if (($5 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $49 = $50 - 0 | 0;
 $$0$i = $49 >> 1 >>> 0 < 1073741823 ? ($49 >>> 0 < $6 >>> 0 ? $6 : $49) : 2147483647;
 if (($$0$i | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $56 = __Znwj($$0$i << 1) | 0;
 $57 = $0 + 4 | 0;
 HEAP32[$57 >> 2] = $56;
 HEAP32[$0 >> 2] = $56;
 HEAP32[$7 >> 2] = $56 + ($$0$i << 1);
 if (($5 | 0) <= 0) return;
 _memcpy($56 | 0, $1 | 0, $5 | 0) | 0;
 HEAP32[$57 >> 2] = $56 + ($6 << 1);
 return;
}

function __ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0, $1, $2, $3, $4) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 var $$037$off039 = 0, $11 = 0, $19 = 0, $25 = 0, $28 = 0, $29 = 0, $31 = 0, $38 = 0, $48 = 0, $50 = 0, label = 0;
 do if (($0 | 0) == (HEAP32[$1 + 8 >> 2] | 0)) {
  if ((HEAP32[$1 + 4 >> 2] | 0) == ($2 | 0)) {
   $11 = $1 + 28 | 0;
   if ((HEAP32[$11 >> 2] | 0) != 1) HEAP32[$11 >> 2] = $3;
  }
 } else {
  if (($0 | 0) != (HEAP32[$1 >> 2] | 0)) {
   $50 = HEAP32[$0 + 8 >> 2] | 0;
   FUNCTION_TABLE_viiiii[HEAP32[(HEAP32[$50 >> 2] | 0) + 24 >> 2] & 3]($50, $1, $2, $3, $4);
   break;
  }
  if ((HEAP32[$1 + 16 >> 2] | 0) != ($2 | 0)) {
   $19 = $1 + 20 | 0;
   if ((HEAP32[$19 >> 2] | 0) != ($2 | 0)) {
    HEAP32[$1 + 32 >> 2] = $3;
    $25 = $1 + 44 | 0;
    if ((HEAP32[$25 >> 2] | 0) == 4) break;
    $28 = $1 + 52 | 0;
    HEAP8[$28 >> 0] = 0;
    $29 = $1 + 53 | 0;
    HEAP8[$29 >> 0] = 0;
    $31 = HEAP32[$0 + 8 >> 2] | 0;
    FUNCTION_TABLE_viiiiii[HEAP32[(HEAP32[$31 >> 2] | 0) + 20 >> 2] & 3]($31, $1, $2, $2, 1, $4);
    if (!(HEAP8[$29 >> 0] | 0)) {
     $$037$off039 = 0;
     label = 13;
    } else if (!(HEAP8[$28 >> 0] | 0)) {
     $$037$off039 = 1;
     label = 13;
    } else label = 17;
    do if ((label | 0) == 13) {
     HEAP32[$19 >> 2] = $2;
     $38 = $1 + 40 | 0;
     HEAP32[$38 >> 2] = (HEAP32[$38 >> 2] | 0) + 1;
     if ((HEAP32[$1 + 36 >> 2] | 0) == 1) if ((HEAP32[$1 + 24 >> 2] | 0) == 2) {
      HEAP8[$1 + 54 >> 0] = 1;
      if ($$037$off039) {
       label = 17;
       break;
      } else {
       $48 = 4;
       break;
      }
     }
     if ($$037$off039) label = 17; else $48 = 4;
    } while (0);
    if ((label | 0) == 17) $48 = 3;
    HEAP32[$25 >> 2] = $48;
    break;
   }
  }
  if (($3 | 0) == 1) HEAP32[$1 + 32 >> 2] = 1;
 } while (0);
 return;
}

function __Z13haarTransformRNSt3__26vectorIsNS_9allocatorIsEEEE($0) {
 $0 = $0 | 0;
 var $$039 = 0, $$04046 = 0, $$04143 = 0, $$044 = 0, $1 = 0, $12 = 0, $14 = 0, $16 = 0, $17 = 0, $2 = 0, $22 = 0, $23 = 0, $31 = 0, $34 = 0.0, $38 = 0.0, $6 = 0, label = 0, sp = 0, $$04046$looptemp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $1 = sp;
 $2 = $0 + 4 | 0;
 $6 = (HEAP32[$2 >> 2] | 0) - (HEAP32[$0 >> 2] | 0) >> 1;
 if (($6 | 0) == 0 | ($6 + -1 & $6 | 0) != 0) {
  $$039 = 0;
  STACKTOP = sp;
  return $$039 | 0;
 }
 __ZNSt3__26vectorIsNS_9allocatorIsEEEC2Ej($1, $6);
 $12 = HEAP32[$0 >> 2] | 0;
 $14 = (HEAP32[$2 >> 2] | 0) - $12 >> 1;
 $16 = $12;
 $17 = HEAP32[$1 >> 2] | 0;
 L4 : do if ($14 >>> 0 > 1) {
  $$04046 = $14;
  while (1) {
   $$04046$looptemp = $$04046;
   $$04046 = $$04046 >>> 1;
   if ($$04046 | 0) {
    $$04143 = 0;
    do {
     $31 = $$04143 << 1;
     $34 = +(HEAP16[$16 + ($31 << 1) >> 1] | 0);
     $38 = +(HEAP16[$16 + (($31 | 1) << 1) >> 1] | 0);
     HEAP16[$17 + ($$04143 << 1) >> 1] = ~~+Math_floor(+(($34 + $38) * .5));
     HEAP16[$17 + ($$04143 + $$04046 << 1) >> 1] = ~~($34 - $38);
     $$04143 = $$04143 + 1 | 0;
    } while (($$04143 | 0) != ($$04046 | 0));
   }
   if (!$$04046$looptemp) {
    label = 5;
    break L4;
   } else $$044 = 0;
   do {
    HEAP16[$16 + ($$044 << 1) >> 1] = HEAP16[$17 + ($$044 << 1) >> 1] | 0;
    $$044 = $$044 + 1 | 0;
   } while (($$044 | 0) != ($$04046$looptemp | 0));
   if ($$04046$looptemp >>> 0 <= 3) {
    label = 6;
    break;
   }
  }
 } else label = 5; while (0);
 if ((label | 0) == 5) if ($17 | 0) label = 6;
 if ((label | 0) == 6) {
  $22 = $1 + 4 | 0;
  $23 = HEAP32[$22 >> 2] | 0;
  if (($23 | 0) != ($17 | 0)) HEAP32[$22 >> 2] = $23 + (~(($23 + -2 - $17 | 0) >>> 1) << 1);
  __ZdlPv($17);
 }
 $$039 = 1;
 STACKTOP = sp;
 return $$039 | 0;
}

function __Z14ihaarTransformRNSt3__26vectorIsNS_9allocatorIsEEEE($0) {
 $0 = $0 | 0;
 var $$043 = 0, $$04450 = 0, $$04547 = 0, $$048 = 0, $$sink$in = 0, $1 = 0, $12 = 0, $14 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $22 = 0, $23 = 0, $24 = 0, $32 = 0, $39 = 0, $6 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $1 = sp;
 $2 = $0 + 4 | 0;
 $6 = (HEAP32[$2 >> 2] | 0) - (HEAP32[$0 >> 2] | 0) >> 1;
 if (($6 | 0) == 0 | ($6 + -1 & $6 | 0) != 0) {
  $$043 = 0;
  STACKTOP = sp;
  return $$043 | 0;
 }
 __ZNSt3__26vectorIsNS_9allocatorIsEEEC2Ej($1, $6);
 $12 = HEAP32[$0 >> 2] | 0;
 $14 = (HEAP32[$2 >> 2] | 0) - $12 >> 1;
 $16 = $12;
 if ($14 >>> 0 >= 2) {
  $17 = HEAP32[$1 >> 2] | 0;
  $$04450 = 2;
  do {
   $18 = ($$04450 | 0) == 0;
   if (!$18) {
    $19 = $$04450 >>> 1;
    $$04547 = 0;
    do {
     if (!($$04547 & 1)) {
      $32 = $$04547 >>> 1;
      $39 = HEAP16[$16 + ($32 + $19 << 1) >> 1] | 0;
      $$sink$in = (($39 & 1 | HEAP16[$16 + ($32 << 1) >> 1] << 1) + $39 | 0) / 2 | 0;
     } else $$sink$in = (HEAPU16[$17 + ($$04547 + -1 << 1) >> 1] | 0) - (HEAPU16[$16 + (($$04547 >>> 1) + $19 << 1) >> 1] | 0) | 0;
     HEAP16[$17 + ($$04547 << 1) >> 1] = $$sink$in;
     $$04547 = $$04547 + 1 | 0;
    } while (($$04547 | 0) != ($$04450 | 0));
    if (!$18) {
     $$048 = 0;
     do {
      HEAP16[$16 + ($$048 << 1) >> 1] = HEAP16[$17 + ($$048 << 1) >> 1] | 0;
      $$048 = $$048 + 1 | 0;
     } while (($$048 | 0) != ($$04450 | 0));
    }
   }
   $$04450 = $$04450 << 1;
  } while ($$04450 >>> 0 <= $14 >>> 0);
 }
 $20 = HEAP32[$1 >> 2] | 0;
 $22 = $20;
 if ($20 | 0) {
  $23 = $1 + 4 | 0;
  $24 = HEAP32[$23 >> 2] | 0;
  if (($24 | 0) != ($20 | 0)) HEAP32[$23 >> 2] = $24 + (~(($24 + -2 - $22 | 0) >>> 1) << 1);
  __ZdlPv($20);
 }
 $$043 = 1;
 STACKTOP = sp;
 return $$043 | 0;
}

function __ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev($0) {
 $0 = $0 | 0;
 __embind_register_void(504, 13403);
 __embind_register_bool(520, 13408, 1, 1, 0);
 __embind_register_integer(528, 13413, 1, -128, 127);
 __embind_register_integer(544, 13418, 1, -128, 127);
 __embind_register_integer(536, 13430, 1, 0, 255);
 __embind_register_integer(552, 13444, 2, -32768, 32767);
 __embind_register_integer(560, 13450, 2, 0, 65535);
 __embind_register_integer(568, 13465, 4, -2147483648, 2147483647);
 __embind_register_integer(576, 13469, 4, 0, -1);
 __embind_register_integer(584, 13482, 4, -2147483648, 2147483647);
 __embind_register_integer(592, 13487, 4, 0, -1);
 __embind_register_float(600, 13501, 4);
 __embind_register_float(608, 13507, 8);
 __embind_register_std_string(184, 13514);
 __embind_register_std_string(208, 13526);
 __embind_register_std_wstring(232, 4, 13559);
 __embind_register_emval(64, 13572);
 __embind_register_memory_view(256, 0, 13588);
 __embind_register_memory_view(264, 0, 13618);
 __embind_register_memory_view(272, 1, 13655);
 __embind_register_memory_view(280, 2, 13694);
 __embind_register_memory_view(288, 3, 13725);
 __embind_register_memory_view(296, 4, 13765);
 __embind_register_memory_view(304, 5, 13794);
 __embind_register_memory_view(312, 4, 13832);
 __embind_register_memory_view(320, 5, 13862);
 __embind_register_memory_view(264, 0, 13901);
 __embind_register_memory_view(272, 1, 13933);
 __embind_register_memory_view(280, 2, 13966);
 __embind_register_memory_view(288, 3, 13999);
 __embind_register_memory_view(296, 4, 14033);
 __embind_register_memory_view(304, 5, 14066);
 __embind_register_memory_view(328, 6, 14100);
 __embind_register_memory_view(336, 7, 14131);
 __embind_register_memory_view(344, 7, 14163);
 return;
}

function _init_block($0) {
 $0 = $0 | 0;
 var $$020 = 0;
 $$020 = 0;
 do {
  HEAP16[$0 + 148 + ($$020 << 2) >> 1] = 0;
  $$020 = $$020 + 1 | 0;
 } while (($$020 | 0) != 286);
 HEAP16[$0 + 2440 >> 1] = 0;
 HEAP16[$0 + 2444 >> 1] = 0;
 HEAP16[$0 + 2448 >> 1] = 0;
 HEAP16[$0 + 2452 >> 1] = 0;
 HEAP16[$0 + 2456 >> 1] = 0;
 HEAP16[$0 + 2460 >> 1] = 0;
 HEAP16[$0 + 2464 >> 1] = 0;
 HEAP16[$0 + 2468 >> 1] = 0;
 HEAP16[$0 + 2472 >> 1] = 0;
 HEAP16[$0 + 2476 >> 1] = 0;
 HEAP16[$0 + 2480 >> 1] = 0;
 HEAP16[$0 + 2484 >> 1] = 0;
 HEAP16[$0 + 2488 >> 1] = 0;
 HEAP16[$0 + 2492 >> 1] = 0;
 HEAP16[$0 + 2496 >> 1] = 0;
 HEAP16[$0 + 2500 >> 1] = 0;
 HEAP16[$0 + 2504 >> 1] = 0;
 HEAP16[$0 + 2508 >> 1] = 0;
 HEAP16[$0 + 2512 >> 1] = 0;
 HEAP16[$0 + 2516 >> 1] = 0;
 HEAP16[$0 + 2520 >> 1] = 0;
 HEAP16[$0 + 2524 >> 1] = 0;
 HEAP16[$0 + 2528 >> 1] = 0;
 HEAP16[$0 + 2532 >> 1] = 0;
 HEAP16[$0 + 2536 >> 1] = 0;
 HEAP16[$0 + 2540 >> 1] = 0;
 HEAP16[$0 + 2544 >> 1] = 0;
 HEAP16[$0 + 2548 >> 1] = 0;
 HEAP16[$0 + 2552 >> 1] = 0;
 HEAP16[$0 + 2556 >> 1] = 0;
 HEAP16[$0 + 2684 >> 1] = 0;
 HEAP16[$0 + 2688 >> 1] = 0;
 HEAP16[$0 + 2692 >> 1] = 0;
 HEAP16[$0 + 2696 >> 1] = 0;
 HEAP16[$0 + 2700 >> 1] = 0;
 HEAP16[$0 + 2704 >> 1] = 0;
 HEAP16[$0 + 2708 >> 1] = 0;
 HEAP16[$0 + 2712 >> 1] = 0;
 HEAP16[$0 + 2716 >> 1] = 0;
 HEAP16[$0 + 2720 >> 1] = 0;
 HEAP16[$0 + 2724 >> 1] = 0;
 HEAP16[$0 + 2728 >> 1] = 0;
 HEAP16[$0 + 2732 >> 1] = 0;
 HEAP16[$0 + 2736 >> 1] = 0;
 HEAP16[$0 + 2740 >> 1] = 0;
 HEAP16[$0 + 2744 >> 1] = 0;
 HEAP16[$0 + 2748 >> 1] = 0;
 HEAP16[$0 + 2752 >> 1] = 0;
 HEAP16[$0 + 2756 >> 1] = 0;
 HEAP16[$0 + 1172 >> 1] = 1;
 HEAP32[$0 + 5804 >> 2] = 0;
 HEAP32[$0 + 5800 >> 2] = 0;
 HEAP32[$0 + 5808 >> 2] = 0;
 HEAP32[$0 + 5792 >> 2] = 0;
 return;
}

function __Z9thresholdRNSt3__26vectorIsNS_9allocatorIsEEEEi($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$03247$us = 0, $$03346$us = 0, $$044$us = 0, $$1$lcssa$us = 0, $$134$lcssa$us = 0, $$13442$us = 0, $$143$us = 0, $$2$us = 0, $$235$us = 0, $$cast = 0, $11 = 0, $12 = 0, $14 = 0, $15 = 0, $22 = 0, $4 = 0, $6 = 0, $indvars$iv = 0;
 $4 = HEAP32[$0 >> 2] | 0;
 $6 = (HEAP32[$0 + 4 >> 2] | 0) - $4 >> 1;
 $$cast = $4;
 if ($6 >>> 0 > 2) {
  $$03247$us = 0;
  $$03346$us = 0;
  $indvars$iv = 1;
 } else {
  $22 = 0;
  return $22 | 0;
 }
 while (1) {
  if (($$03346$us | 0) < ($1 | 0)) {
   $$044$us = 2;
   $$13442$us = $$03346$us;
   $$143$us = $$03247$us;
   while (1) {
    $11 = $$cast + ($$044$us << 1) | 0;
    $12 = HEAP16[$11 >> 1] | 0;
    if (!($12 << 16 >> 16)) {
     $$2$us = $$143$us;
     $$235$us = $$13442$us;
    } else {
     $14 = $12 << 16 >> 16;
     $15 = $12 << 16 >> 16 > -1 ? $14 : 0 - $14 | 0;
     if (($15 | 0) > ($indvars$iv | 0)) {
      $$2$us = $$143$us;
      $$235$us = $$13442$us;
     } else {
      HEAP16[$11 >> 1] = 0;
      $$2$us = $15 + $$143$us | 0;
      $$235$us = $$13442$us + 1 | 0;
     }
    }
    $$044$us = $$044$us + 1 | 0;
    if (!(($$235$us | 0) < ($1 | 0) & $$044$us >>> 0 < $6 >>> 0)) {
     $$1$lcssa$us = $$2$us;
     $$134$lcssa$us = $$235$us;
     break;
    } else {
     $$13442$us = $$235$us;
     $$143$us = $$2$us;
    }
   }
  } else {
   $$1$lcssa$us = $$03247$us;
   $$134$lcssa$us = $$03346$us;
  }
  $indvars$iv = $indvars$iv + 1 | 0;
  if (!(($$134$lcssa$us | 0) != ($1 | 0) & ($indvars$iv | 0) < 100)) {
   $22 = $$1$lcssa$us;
   break;
  } else {
   $$03247$us = $$1$lcssa$us;
   $$03346$us = $$134$lcssa$us;
  }
 }
 return $22 | 0;
}

function _deflateEnd($0) {
 $0 = $0 | 0;
 var $$0 = 0, $$in = 0, $$in30 = 0, $$in31 = 0, $$pre$phiZ2D = 0, $14 = 0, $16 = 0, $21 = 0, $27 = 0, $33 = 0, $36 = 0, $40 = 0, $5 = 0, $6 = 0, $8 = 0, $9 = 0;
 if (!$0) {
  $$0 = -2;
  return $$0 | 0;
 }
 if (!(HEAP32[$0 + 32 >> 2] | 0)) {
  $$0 = -2;
  return $$0 | 0;
 }
 $5 = $0 + 36 | 0;
 $6 = HEAP32[$5 >> 2] | 0;
 if (!$6) {
  $$0 = -2;
  return $$0 | 0;
 }
 $8 = $0 + 28 | 0;
 $9 = HEAP32[$8 >> 2] | 0;
 if (!$9) {
  $$0 = -2;
  return $$0 | 0;
 }
 if ((HEAP32[$9 >> 2] | 0) != ($0 | 0)) {
  $$0 = -2;
  return $$0 | 0;
 }
 $14 = HEAP32[$9 + 4 >> 2] | 0;
 switch ($14 | 0) {
 case 666:
 case 113:
 case 103:
 case 91:
 case 73:
 case 69:
 case 57:
 case 42:
  break;
 default:
  {
   $$0 = -2;
   return $$0 | 0;
  }
 }
 $16 = HEAP32[$9 + 8 >> 2] | 0;
 if (!$16) $$in = $9; else {
  FUNCTION_TABLE_vii[$6 & 3](HEAP32[$0 + 40 >> 2] | 0, $16);
  $$in = HEAP32[$8 >> 2] | 0;
 }
 $21 = HEAP32[$$in + 68 >> 2] | 0;
 if (!$21) $$in30 = $$in; else {
  FUNCTION_TABLE_vii[HEAP32[$5 >> 2] & 3](HEAP32[$0 + 40 >> 2] | 0, $21);
  $$in30 = HEAP32[$8 >> 2] | 0;
 }
 $27 = HEAP32[$$in30 + 64 >> 2] | 0;
 if (!$27) $$in31 = $$in30; else {
  FUNCTION_TABLE_vii[HEAP32[$5 >> 2] & 3](HEAP32[$0 + 40 >> 2] | 0, $27);
  $$in31 = HEAP32[$8 >> 2] | 0;
 }
 $33 = HEAP32[$$in31 + 56 >> 2] | 0;
 if (!$33) {
  $$pre$phiZ2D = $0 + 40 | 0;
  $40 = $$in31;
 } else {
  $36 = $0 + 40 | 0;
  FUNCTION_TABLE_vii[HEAP32[$5 >> 2] & 3](HEAP32[$36 >> 2] | 0, $33);
  $$pre$phiZ2D = $36;
  $40 = HEAP32[$8 >> 2] | 0;
 }
 FUNCTION_TABLE_vii[HEAP32[$5 >> 2] & 3](HEAP32[$$pre$phiZ2D >> 2] | 0, $40);
 HEAP32[$8 >> 2] = 0;
 $$0 = ($14 | 0) == 113 ? -3 : 0;
 return $$0 | 0;
}

function _vfprintf($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$ = 0, $$0 = 0, $$1 = 0, $13 = 0, $14 = 0, $19 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $28 = 0, $29 = 0, $3 = 0, $35 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, dest = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224 | 0;
 $3 = sp + 120 | 0;
 $4 = sp + 80 | 0;
 $5 = sp;
 $6 = sp + 136 | 0;
 dest = $4;
 stop = dest + 40 | 0;
 do {
  HEAP32[dest >> 2] = 0;
  dest = dest + 4 | 0;
 } while ((dest | 0) < (stop | 0));
 HEAP32[$3 >> 2] = HEAP32[$2 >> 2];
 if ((_printf_core(0, $1, $3, $5, $4) | 0) < 0) $$0 = -1; else {
  if ((HEAP32[$0 + 76 >> 2] | 0) > -1) $39 = ___lockfile($0) | 0; else $39 = 0;
  $13 = HEAP32[$0 >> 2] | 0;
  $14 = $13 & 32;
  if ((HEAP8[$0 + 74 >> 0] | 0) < 1) HEAP32[$0 >> 2] = $13 & -33;
  $19 = $0 + 48 | 0;
  if (!(HEAP32[$19 >> 2] | 0)) {
   $23 = $0 + 44 | 0;
   $24 = HEAP32[$23 >> 2] | 0;
   HEAP32[$23 >> 2] = $6;
   $25 = $0 + 28 | 0;
   HEAP32[$25 >> 2] = $6;
   $26 = $0 + 20 | 0;
   HEAP32[$26 >> 2] = $6;
   HEAP32[$19 >> 2] = 80;
   $28 = $0 + 16 | 0;
   HEAP32[$28 >> 2] = $6 + 80;
   $29 = _printf_core($0, $1, $3, $5, $4) | 0;
   if (!$24) $$1 = $29; else {
    FUNCTION_TABLE_iiii[HEAP32[$0 + 36 >> 2] & 15]($0, 0, 0) | 0;
    $$ = (HEAP32[$26 >> 2] | 0) == 0 ? -1 : $29;
    HEAP32[$23 >> 2] = $24;
    HEAP32[$19 >> 2] = 0;
    HEAP32[$28 >> 2] = 0;
    HEAP32[$25 >> 2] = 0;
    HEAP32[$26 >> 2] = 0;
    $$1 = $$;
   }
  } else $$1 = _printf_core($0, $1, $3, $5, $4) | 0;
  $35 = HEAP32[$0 >> 2] | 0;
  HEAP32[$0 >> 2] = $35 | $14;
  if ($39 | 0) ___unlockfile($0);
  $$0 = ($35 & 32 | 0) == 0 ? $$1 : -1;
 }
 STACKTOP = sp;
 return $$0 | 0;
}

function __ZNSt3__26vectorIsNS_9allocatorIsEEE8__appendEjRKs($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0$i = 0, $$0$i12 = 0, $$0$i14 = 0, $10 = 0, $12 = 0, $16 = 0, $19 = 0, $21 = 0, $26 = 0, $29 = 0, $3 = 0, $32 = 0, $33 = 0, $34 = 0, $36 = 0, $4 = 0, $42 = 0, $45 = 0, $5 = 0, $6 = 0;
 $3 = $0 + 8 | 0;
 $4 = HEAP32[$3 >> 2] | 0;
 $5 = $0 + 4 | 0;
 $6 = HEAP32[$5 >> 2] | 0;
 $10 = $6;
 if ($4 - $6 >> 1 >>> 0 >= $1 >>> 0) {
  $$0$i = $1;
  $12 = $10;
  while (1) {
   HEAP16[$12 >> 1] = HEAP16[$2 >> 1] | 0;
   $$0$i = $$0$i + -1 | 0;
   if (!$$0$i) break; else $12 = $12 + 2 | 0;
  }
  HEAP32[$5 >> 2] = $10 + ($1 << 1);
  return;
 }
 $16 = HEAP32[$0 >> 2] | 0;
 $19 = ($6 - $16 >> 1) + $1 | 0;
 if (($19 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $21 = $4 - $16 | 0;
 $$0$i14 = $21 >> 1 >>> 0 < 1073741823 ? ($21 >>> 0 < $19 >>> 0 ? $19 : $21) : 2147483647;
 $26 = $6 - $16 >> 1;
 do if (!$$0$i14) $33 = 0; else if (($$0$i14 | 0) < 0) {
  $29 = ___cxa_allocate_exception(4) | 0;
  __ZNSt9bad_allocC2Ev($29);
  ___cxa_throw($29 | 0, 424, 6);
 } else {
  $33 = __Znwj($$0$i14 << 1) | 0;
  break;
 } while (0);
 $32 = $33 + ($26 << 1) | 0;
 $34 = $33 + ($$0$i14 << 1) | 0;
 $$0$i12 = $1;
 $36 = $32;
 while (1) {
  HEAP16[$36 >> 1] = HEAP16[$2 >> 1] | 0;
  $$0$i12 = $$0$i12 + -1 | 0;
  if (!$$0$i12) break; else $36 = $36 + 2 | 0;
 }
 $42 = $6 - $16 | 0;
 $45 = $32 + (0 - ($42 >> 1) << 1) | 0;
 if (($42 | 0) > 0) _memcpy($45 | 0, $16 | 0, $42 | 0) | 0;
 HEAP32[$0 >> 2] = $45;
 HEAP32[$5 >> 2] = $32 + ($1 << 1);
 HEAP32[$3 >> 2] = $34;
 if (!$16) return;
 __ZdlPv($16);
 return;
}

function ___dynamic_cast($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $$0 = 0, $10 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $4 = 0, $5 = 0, $8 = 0, dest = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64 | 0;
 $4 = sp;
 $5 = HEAP32[$0 >> 2] | 0;
 $8 = $0 + (HEAP32[$5 + -8 >> 2] | 0) | 0;
 $10 = HEAP32[$5 + -4 >> 2] | 0;
 HEAP32[$4 >> 2] = $2;
 HEAP32[$4 + 4 >> 2] = $0;
 HEAP32[$4 + 8 >> 2] = $1;
 HEAP32[$4 + 12 >> 2] = $3;
 $14 = $4 + 16 | 0;
 $15 = $4 + 20 | 0;
 $16 = $4 + 24 | 0;
 $17 = $4 + 28 | 0;
 $18 = $4 + 32 | 0;
 $19 = $4 + 40 | 0;
 $20 = ($10 | 0) == ($2 | 0);
 dest = $14;
 stop = dest + 36 | 0;
 do {
  HEAP32[dest >> 2] = 0;
  dest = dest + 4 | 0;
 } while ((dest | 0) < (stop | 0));
 HEAP16[$14 + 36 >> 1] = 0;
 HEAP8[$14 + 38 >> 0] = 0;
 L1 : do if ($20) {
  HEAP32[$4 + 48 >> 2] = 1;
  FUNCTION_TABLE_viiiiii[HEAP32[(HEAP32[$2 >> 2] | 0) + 20 >> 2] & 3]($2, $4, $8, $8, 1, 0);
  $$0 = (HEAP32[$16 >> 2] | 0) == 1 ? $8 : 0;
 } else {
  FUNCTION_TABLE_viiiii[HEAP32[(HEAP32[$10 >> 2] | 0) + 24 >> 2] & 3]($10, $4, $8, 1, 0);
  switch (HEAP32[$4 + 36 >> 2] | 0) {
  case 0:
   {
    $$0 = (HEAP32[$19 >> 2] | 0) == 1 & (HEAP32[$17 >> 2] | 0) == 1 & (HEAP32[$18 >> 2] | 0) == 1 ? HEAP32[$15 >> 2] | 0 : 0;
    break L1;
    break;
   }
  case 1:
   break;
  default:
   {
    $$0 = 0;
    break L1;
   }
  }
  if ((HEAP32[$16 >> 2] | 0) != 1) if (!((HEAP32[$19 >> 2] | 0) == 0 & (HEAP32[$17 >> 2] | 0) == 1 & (HEAP32[$18 >> 2] | 0) == 1)) {
   $$0 = 0;
   break;
  }
  $$0 = HEAP32[$14 >> 2] | 0;
 } while (0);
 STACKTOP = sp;
 return $$0 | 0;
}

function __ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0 = 0, $$4 = 0, $19 = 0, $20 = 0, $25 = 0, $27 = 0, $29 = 0, $3 = 0, $9 = 0, dest = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64 | 0;
 $3 = sp;
 HEAP32[$2 >> 2] = HEAP32[HEAP32[$2 >> 2] >> 2];
 if (($0 | 0) == ($1 | 0) | ($1 | 0) == 512) $$4 = 1; else if (!$1) $$4 = 0; else {
  $9 = ___dynamic_cast($1, 384, 472, 0) | 0;
  if (!$9) $$4 = 0; else if (!(HEAP32[$9 + 8 >> 2] & ~HEAP32[$0 + 8 >> 2])) {
   $19 = HEAP32[$0 + 12 >> 2] | 0;
   $20 = $9 + 12 | 0;
   if (($19 | 0) == 504 ? 1 : ($19 | 0) == (HEAP32[$20 >> 2] | 0)) $$4 = 1; else if (!$19) $$4 = 0; else {
    $25 = ___dynamic_cast($19, 384, 368, 0) | 0;
    if (!$25) $$4 = 0; else {
     $27 = HEAP32[$20 >> 2] | 0;
     if (!$27) $$4 = 0; else {
      $29 = ___dynamic_cast($27, 384, 368, 0) | 0;
      if (!$29) $$4 = 0; else {
       dest = $3 + 4 | 0;
       stop = dest + 52 | 0;
       do {
        HEAP32[dest >> 2] = 0;
        dest = dest + 4 | 0;
       } while ((dest | 0) < (stop | 0));
       HEAP32[$3 >> 2] = $29;
       HEAP32[$3 + 8 >> 2] = $25;
       HEAP32[$3 + 12 >> 2] = -1;
       HEAP32[$3 + 48 >> 2] = 1;
       FUNCTION_TABLE_viiii[HEAP32[(HEAP32[$29 >> 2] | 0) + 28 >> 2] & 7]($29, $3, HEAP32[$2 >> 2] | 0, 1);
       if ((HEAP32[$3 + 24 >> 2] | 0) == 1) {
        HEAP32[$2 >> 2] = HEAP32[$3 + 16 >> 2];
        $$0 = 1;
       } else $$0 = 0;
       $$4 = $$0;
      }
     }
    }
   }
  } else $$4 = 0;
 }
 STACKTOP = sp;
 return $$4 | 0;
}

function __ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0, $1, $2, $3, $4, $5) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 $5 = $5 | 0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $14 = 0, $17 = 0, $18 = 0, $21 = 0, $22 = 0, $23 = 0, $26 = 0, $9 = 0;
 if (($0 | 0) == (HEAP32[$1 + 8 >> 2] | 0)) __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0, $1, $2, $3, $4); else {
  $9 = $1 + 52 | 0;
  $10 = HEAP16[$9 >> 1] | 0;
  $11 = $10 & 255;
  $12 = $1 + 53 | 0;
  $14 = ($10 & 65535) >>> 8 & 255;
  $17 = HEAP32[$0 + 12 >> 2] | 0;
  $18 = $0 + 16 + ($17 << 3) | 0;
  HEAP8[$9 >> 0] = 0;
  HEAP8[$12 >> 0] = 0;
  __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0 + 16 | 0, $1, $2, $3, $4, $5);
  L4 : do if (($17 | 0) > 1) {
   $21 = $1 + 24 | 0;
   $22 = $0 + 8 | 0;
   $23 = $1 + 54 | 0;
   $$0 = $0 + 24 | 0;
   do {
    if (HEAP8[$23 >> 0] | 0) break L4;
    $26 = HEAP16[$9 >> 1] | 0;
    if (!(($26 & 255) << 24 >> 24)) {
     if (($26 & 65535) >= 256) if (!(HEAP32[$22 >> 2] & 1)) break L4;
    } else {
     if ((HEAP32[$21 >> 2] | 0) == 1) break L4;
     if (!(HEAP32[$22 >> 2] & 2)) break L4;
    }
    HEAP8[$9 >> 0] = 0;
    HEAP8[$12 >> 0] = 0;
    __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($$0, $1, $2, $3, $4, $5);
    $$0 = $$0 + 8 | 0;
   } while ($$0 >>> 0 < $18 >>> 0);
  } while (0);
  HEAP8[$9 >> 0] = $11;
  HEAP8[$12 >> 0] = $14;
 }
 return;
}

function __ZL25default_terminate_handlerv() {
 var $0 = 0, $1 = 0, $12 = 0, $22 = 0, $23 = 0, $25 = 0, $3 = 0, $30 = 0, $31 = 0, $35 = 0, $7 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer10 = 0, $vararg_buffer3 = 0, $vararg_buffer7 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48 | 0;
 $vararg_buffer10 = sp + 32 | 0;
 $vararg_buffer7 = sp + 24 | 0;
 $vararg_buffer3 = sp + 16 | 0;
 $vararg_buffer = sp;
 $0 = sp + 36 | 0;
 $1 = ___cxa_get_globals_fast() | 0;
 if ($1 | 0) {
  $3 = HEAP32[$1 >> 2] | 0;
  if ($3 | 0) {
   $7 = $3 + 48 | 0;
   $9 = HEAP32[$7 >> 2] | 0;
   $12 = HEAP32[$7 + 4 >> 2] | 0;
   if (!(($9 & -256 | 0) == 1126902528 & ($12 | 0) == 1129074247)) {
    HEAP32[$vararg_buffer7 >> 2] = HEAP32[2574];
    _abort_message(17404, $vararg_buffer7);
   }
   if (($9 | 0) == 1126902529 & ($12 | 0) == 1129074247) $22 = HEAP32[$3 + 44 >> 2] | 0; else $22 = $3 + 80 | 0;
   HEAP32[$0 >> 2] = $22;
   $23 = HEAP32[$3 >> 2] | 0;
   $25 = HEAP32[$23 + 4 >> 2] | 0;
   if (FUNCTION_TABLE_iiii[HEAP32[(HEAP32[90] | 0) + 16 >> 2] & 15](360, $23, $0) | 0) {
    $30 = HEAP32[$0 >> 2] | 0;
    $31 = HEAP32[2574] | 0;
    $35 = FUNCTION_TABLE_ii[HEAP32[(HEAP32[$30 >> 2] | 0) + 8 >> 2] & 15]($30) | 0;
    HEAP32[$vararg_buffer >> 2] = $31;
    HEAP32[$vararg_buffer + 4 >> 2] = $25;
    HEAP32[$vararg_buffer + 8 >> 2] = $35;
    _abort_message(17318, $vararg_buffer);
   } else {
    HEAP32[$vararg_buffer3 >> 2] = HEAP32[2574];
    HEAP32[$vararg_buffer3 + 4 >> 2] = $25;
    _abort_message(17363, $vararg_buffer3);
   }
  }
 }
 _abort_message(17442, $vararg_buffer10);
}

function __ZNSt3__26vectorIhNS_9allocatorIhEEE8__appendEjRKh($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0$i = 0, $$0$i13 = 0, $$0$i14 = 0, $$sroa$12$0 = 0, $11 = 0, $16 = 0, $18 = 0, $20 = 0, $22 = 0, $27 = 0, $28 = 0, $3 = 0, $30 = 0, $32 = 0, $39 = 0, $4 = 0, $42 = 0, $44 = 0, $5 = 0, $6 = 0;
 $3 = $0 + 8 | 0;
 $4 = HEAP32[$3 >> 2] | 0;
 $5 = $0 + 4 | 0;
 $6 = HEAP32[$5 >> 2] | 0;
 if (($4 - $6 | 0) >>> 0 >= $1 >>> 0) {
  $$0$i = $1;
  $11 = $6;
  do {
   HEAP8[$11 >> 0] = HEAP8[$2 >> 0] | 0;
   $11 = (HEAP32[$5 >> 2] | 0) + 1 | 0;
   HEAP32[$5 >> 2] = $11;
   $$0$i = $$0$i + -1 | 0;
  } while (($$0$i | 0) != 0);
  return;
 }
 $16 = HEAP32[$0 >> 2] | 0;
 $18 = $6 - $16 + $1 | 0;
 if (($18 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $20 = $4 - $16 | 0;
 $22 = $20 << 1;
 $$0$i14 = $20 >>> 0 < 1073741823 ? ($22 >>> 0 < $18 >>> 0 ? $18 : $22) : 2147483647;
 if (!$$0$i14) $28 = 0; else $28 = __Znwj($$0$i14) | 0;
 $27 = $28 + ($6 - $16) | 0;
 $30 = $28 + $$0$i14 | 0;
 $$0$i13 = $1;
 $$sroa$12$0 = $27;
 $32 = $27;
 do {
  HEAP8[$32 >> 0] = HEAP8[$2 >> 0] | 0;
  $32 = $$sroa$12$0 + 1 | 0;
  $$sroa$12$0 = $32;
  $$0$i13 = $$0$i13 + -1 | 0;
 } while (($$0$i13 | 0) != 0);
 $39 = HEAP32[$0 >> 2] | 0;
 $42 = (HEAP32[$5 >> 2] | 0) - $39 | 0;
 $44 = $27 + (0 - $42) | 0;
 if (($42 | 0) > 0) _memcpy($44 | 0, $39 | 0, $42 | 0) | 0;
 HEAP32[$0 >> 2] = $44;
 HEAP32[$5 >> 2] = $$sroa$12$0;
 HEAP32[$3 >> 2] = $30;
 if (!$39) return;
 __ZdlPv($39);
 return;
}

function __ZNSt3__26vectorIbNS_9allocatorIbEEE7reserveEj($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $10 = 0, $14 = 0, $17 = 0, $19 = 0, $2 = 0, $20 = 0, $26 = 0, $28 = 0, $3 = 0, $30 = 0, $4 = 0, $5 = 0, $9 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32 | 0;
 $2 = sp + 16 | 0;
 $3 = sp + 8 | 0;
 $4 = sp;
 $5 = $0 + 8 | 0;
 if (HEAP32[$5 >> 2] << 5 >>> 0 >= $1 >>> 0) {
  STACKTOP = sp;
  return;
 }
 HEAP32[$2 >> 2] = 0;
 $9 = $2 + 4 | 0;
 HEAP32[$9 >> 2] = 0;
 $10 = $2 + 8 | 0;
 HEAP32[$10 >> 2] = 0;
 if (($1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($2);
 $14 = (($1 + -1 | 0) >>> 5) + 1 | 0;
 HEAP32[$2 >> 2] = __Znwj($14 << 2) | 0;
 HEAP32[$9 >> 2] = 0;
 HEAP32[$10 >> 2] = $14;
 $17 = HEAP32[$0 >> 2] | 0;
 HEAP32[$3 >> 2] = $17;
 HEAP32[$3 + 4 >> 2] = 0;
 $19 = $0 + 4 | 0;
 $20 = HEAP32[$19 >> 2] | 0;
 HEAP32[$4 >> 2] = $17 + ($20 >>> 5 << 2);
 HEAP32[$4 + 4 >> 2] = $20 & 31;
 __ZNSt3__26vectorIbNS_9allocatorIbEEE18__construct_at_endINS_14__bit_iteratorIS3_Lb0ELj0EEEEENS_9enable_ifIXsr21__is_forward_iteratorIT_EE5valueEvE4typeES8_S8_($2, $3, $4);
 $26 = HEAP32[$0 >> 2] | 0;
 HEAP32[$0 >> 2] = HEAP32[$2 >> 2];
 HEAP32[$2 >> 2] = $26;
 $28 = HEAP32[$19 >> 2] | 0;
 HEAP32[$19 >> 2] = HEAP32[$9 >> 2];
 HEAP32[$9 >> 2] = $28;
 $30 = HEAP32[$5 >> 2] | 0;
 HEAP32[$5 >> 2] = HEAP32[$10 >> 2];
 HEAP32[$10 >> 2] = $30;
 if ($26 | 0) __ZdlPv($26);
 STACKTOP = sp;
 return;
}

function ___fwritex($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$038 = 0, $$1 = 0, $$139 = 0, $$141 = 0, $$143 = 0, $10 = 0, $12 = 0, $14 = 0, $22 = 0, $28 = 0, $3 = 0, $31 = 0, $4 = 0, $9 = 0, label = 0;
 $3 = $2 + 16 | 0;
 $4 = HEAP32[$3 >> 2] | 0;
 if (!$4) if (!(___towrite($2) | 0)) {
  $12 = HEAP32[$3 >> 2] | 0;
  label = 5;
 } else $$1 = 0; else {
  $12 = $4;
  label = 5;
 }
 L5 : do if ((label | 0) == 5) {
  $9 = $2 + 20 | 0;
  $10 = HEAP32[$9 >> 2] | 0;
  $14 = $10;
  if (($12 - $10 | 0) >>> 0 < $1 >>> 0) {
   $$1 = FUNCTION_TABLE_iiii[HEAP32[$2 + 36 >> 2] & 15]($2, $0, $1) | 0;
   break;
  }
  L10 : do if ((HEAP8[$2 + 75 >> 0] | 0) > -1) {
   $$038 = $1;
   while (1) {
    if (!$$038) {
     $$139 = 0;
     $$141 = $0;
     $$143 = $1;
     $31 = $14;
     break L10;
    }
    $22 = $$038 + -1 | 0;
    if ((HEAP8[$0 + $22 >> 0] | 0) == 10) break; else $$038 = $22;
   }
   $28 = FUNCTION_TABLE_iiii[HEAP32[$2 + 36 >> 2] & 15]($2, $0, $$038) | 0;
   if ($28 >>> 0 < $$038 >>> 0) {
    $$1 = $28;
    break L5;
   }
   $$139 = $$038;
   $$141 = $0 + $$038 | 0;
   $$143 = $1 - $$038 | 0;
   $31 = HEAP32[$9 >> 2] | 0;
  } else {
   $$139 = 0;
   $$141 = $0;
   $$143 = $1;
   $31 = $14;
  } while (0);
  _memcpy($31 | 0, $$141 | 0, $$143 | 0) | 0;
  HEAP32[$9 >> 2] = (HEAP32[$9 >> 2] | 0) + $$143;
  $$1 = $$139 + $$143 | 0;
 } while (0);
 return $$1 | 0;
}

function __ZNSt3__26vectorINS_4pairIfiEENS_9allocatorIS2_EEE21__push_back_slow_pathIS2_EEvOT_($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0$i = 0, $11 = 0, $14 = 0, $17 = 0, $2 = 0, $20 = 0, $23 = 0, $24 = 0, $27 = 0, $3 = 0, $32 = 0, $33 = 0, $39 = 0, $4 = 0, $42 = 0, $7 = 0, $9 = 0;
 $2 = $0 + 4 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 $4 = HEAP32[$0 >> 2] | 0;
 $7 = ($3 - $4 >> 3) + 1 | 0;
 if ($7 >>> 0 > 536870911) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $9 = $0 + 8 | 0;
 $11 = (HEAP32[$9 >> 2] | 0) - $4 | 0;
 $14 = $11 >> 2;
 $$0$i = $11 >> 3 >>> 0 < 268435455 ? ($14 >>> 0 < $7 >>> 0 ? $7 : $14) : 536870911;
 $17 = $3 - $4 >> 3;
 do if (!$$0$i) $24 = 0; else if ($$0$i >>> 0 > 536870911) {
  $20 = ___cxa_allocate_exception(4) | 0;
  __ZNSt9bad_allocC2Ev($20);
  ___cxa_throw($20 | 0, 424, 6);
 } else {
  $24 = __Znwj($$0$i << 3) | 0;
  break;
 } while (0);
 $23 = $24 + ($17 << 3) | 0;
 $27 = $1;
 $32 = HEAP32[$27 + 4 >> 2] | 0;
 $33 = $23;
 HEAP32[$33 >> 2] = HEAP32[$27 >> 2];
 HEAP32[$33 + 4 >> 2] = $32;
 $39 = $3 - $4 | 0;
 $42 = $23 + (0 - ($39 >> 3) << 3) | 0;
 if (($39 | 0) > 0) _memcpy($42 | 0, $4 | 0, $39 | 0) | 0;
 HEAP32[$0 >> 2] = $42;
 HEAP32[$2 >> 2] = $23 + 8;
 HEAP32[$9 >> 2] = $24 + ($$0$i << 3);
 if (!$4) return;
 __ZdlPv($4);
 return;
}

function _memset(ptr, value, num) {
 ptr = ptr | 0;
 value = value | 0;
 num = num | 0;
 var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
 end = ptr + num | 0;
 value = value & 255;
 if ((num | 0) >= 67) {
  while (ptr & 3) {
   HEAP8[ptr >> 0] = value;
   ptr = ptr + 1 | 0;
  }
  aligned_end = end & -4 | 0;
  block_aligned_end = aligned_end - 64 | 0;
  value4 = value | value << 8 | value << 16 | value << 24;
  while ((ptr | 0) <= (block_aligned_end | 0)) {
   HEAP32[ptr >> 2] = value4;
   HEAP32[ptr + 4 >> 2] = value4;
   HEAP32[ptr + 8 >> 2] = value4;
   HEAP32[ptr + 12 >> 2] = value4;
   HEAP32[ptr + 16 >> 2] = value4;
   HEAP32[ptr + 20 >> 2] = value4;
   HEAP32[ptr + 24 >> 2] = value4;
   HEAP32[ptr + 28 >> 2] = value4;
   HEAP32[ptr + 32 >> 2] = value4;
   HEAP32[ptr + 36 >> 2] = value4;
   HEAP32[ptr + 40 >> 2] = value4;
   HEAP32[ptr + 44 >> 2] = value4;
   HEAP32[ptr + 48 >> 2] = value4;
   HEAP32[ptr + 52 >> 2] = value4;
   HEAP32[ptr + 56 >> 2] = value4;
   HEAP32[ptr + 60 >> 2] = value4;
   ptr = ptr + 64 | 0;
  }
  while ((ptr | 0) < (aligned_end | 0)) {
   HEAP32[ptr >> 2] = value4;
   ptr = ptr + 4 | 0;
  }
 }
 while ((ptr | 0) < (end | 0)) {
  HEAP8[ptr >> 0] = value;
  ptr = ptr + 1 | 0;
 }
 return end - num | 0;
}

function _deflateResetKeep($0) {
 $0 = $0 | 0;
 var $$0 = 0, $13 = 0, $23 = 0, $24 = 0, $26 = 0, $27 = 0, $28 = 0, $35 = 0, $9 = 0;
 if (!$0) {
  $$0 = -2;
  return $$0 | 0;
 }
 if (!(HEAP32[$0 + 32 >> 2] | 0)) {
  $$0 = -2;
  return $$0 | 0;
 }
 if (!(HEAP32[$0 + 36 >> 2] | 0)) {
  $$0 = -2;
  return $$0 | 0;
 }
 $9 = HEAP32[$0 + 28 >> 2] | 0;
 if (!$9) {
  $$0 = -2;
  return $$0 | 0;
 }
 if ((HEAP32[$9 >> 2] | 0) != ($0 | 0)) {
  $$0 = -2;
  return $$0 | 0;
 }
 $13 = $9 + 4 | 0;
 switch (HEAP32[$13 >> 2] | 0) {
 case 666:
 case 113:
 case 103:
 case 91:
 case 73:
 case 69:
 case 57:
 case 42:
  break;
 default:
  {
   $$0 = -2;
   return $$0 | 0;
  }
 }
 HEAP32[$0 + 20 >> 2] = 0;
 HEAP32[$0 + 8 >> 2] = 0;
 HEAP32[$0 + 24 >> 2] = 0;
 HEAP32[$0 + 44 >> 2] = 2;
 HEAP32[$9 + 20 >> 2] = 0;
 HEAP32[$9 + 16 >> 2] = HEAP32[$9 + 8 >> 2];
 $23 = $9 + 24 | 0;
 $24 = HEAP32[$23 >> 2] | 0;
 if (($24 | 0) < 0) {
  $26 = 0 - $24 | 0;
  HEAP32[$23 >> 2] = $26;
  $27 = $26;
 } else $27 = $24;
 $28 = ($27 | 0) == 2;
 HEAP32[$13 >> 2] = $28 ? 57 : $27 | 0 ? 42 : 113;
 if ($28) $35 = _crc32(0, 0, 0) | 0; else $35 = _adler32(0, 0, 0) | 0;
 HEAP32[$0 + 48 >> 2] = $35;
 HEAP32[$9 + 40 >> 2] = 0;
 __tr_init($9);
 $$0 = 0;
 return $$0 | 0;
}

function _compress($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $$0$i = 0, $$023$i = 0, $$024$i = 0, $$1$i = 0, $$125$i = 0, $12 = 0, $13 = 0, $14 = 0, $20 = 0, $4 = 0, $5 = 0, $9 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64 | 0;
 $4 = sp;
 $5 = HEAP32[$1 >> 2] | 0;
 HEAP32[$1 >> 2] = 0;
 HEAP32[$4 + 32 >> 2] = 0;
 HEAP32[$4 + 36 >> 2] = 0;
 HEAP32[$4 + 40 >> 2] = 0;
 $9 = _deflateInit_($4, -1, 12493, 56) | 0;
 if ($9 | 0) {
  $$023$i = $9;
  STACKTOP = sp;
  return $$023$i | 0;
 }
 HEAP32[$4 + 12 >> 2] = $0;
 $12 = $4 + 16 | 0;
 HEAP32[$12 >> 2] = 0;
 HEAP32[$4 >> 2] = $2;
 $13 = $4 + 4 | 0;
 HEAP32[$13 >> 2] = 0;
 $$0$i = $5;
 $$024$i = $3;
 $14 = 0;
 while (1) {
  if (!$14) {
   HEAP32[$12 >> 2] = $$0$i;
   $$1$i = 0;
  } else $$1$i = $$0$i;
  if (!(HEAP32[$13 >> 2] | 0)) {
   HEAP32[$13 >> 2] = $$024$i;
   $$125$i = 0;
  } else $$125$i = $$024$i;
  $20 = _deflate($4, $$125$i | 0 ? 0 : 4) | 0;
  if ($20 | 0) break;
  $$0$i = $$1$i;
  $$024$i = $$125$i;
  $14 = HEAP32[$12 >> 2] | 0;
 }
 HEAP32[$1 >> 2] = HEAP32[$4 + 20 >> 2];
 _deflateEnd($4) | 0;
 $$023$i = ($20 | 0) == 1 ? 0 : $20;
 STACKTOP = sp;
 return $$023$i | 0;
}

function __ZNSt3__26vectorIsNS_9allocatorIsEEE21__push_back_slow_pathIRKsEEvOT_($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0$i = 0, $11 = 0, $16 = 0, $19 = 0, $2 = 0, $22 = 0, $23 = 0, $29 = 0, $3 = 0, $32 = 0, $4 = 0, $5 = 0, $7 = 0, $9 = 0;
 $2 = $0 + 4 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 $4 = HEAP32[$0 >> 2] | 0;
 $5 = $3 - $4 | 0;
 $7 = ($5 >> 1) + 1 | 0;
 if (($5 | 0) < -2) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $9 = $0 + 8 | 0;
 $11 = (HEAP32[$9 >> 2] | 0) - $4 | 0;
 $$0$i = $11 >> 1 >>> 0 < 1073741823 ? ($11 >>> 0 < $7 >>> 0 ? $7 : $11) : 2147483647;
 $16 = $3 - $4 >> 1;
 do if (!$$0$i) $23 = 0; else if (($$0$i | 0) < 0) {
  $19 = ___cxa_allocate_exception(4) | 0;
  __ZNSt9bad_allocC2Ev($19);
  ___cxa_throw($19 | 0, 424, 6);
 } else {
  $23 = __Znwj($$0$i << 1) | 0;
  break;
 } while (0);
 $22 = $23 + ($16 << 1) | 0;
 HEAP16[$22 >> 1] = HEAP16[$1 >> 1] | 0;
 $29 = $3 - $4 | 0;
 $32 = $22 + (0 - ($29 >> 1) << 1) | 0;
 if (($29 | 0) > 0) _memcpy($32 | 0, $4 | 0, $29 | 0) | 0;
 HEAP32[$0 >> 2] = $32;
 HEAP32[$2 >> 2] = $22 + 2;
 HEAP32[$9 >> 2] = $23 + ($$0$i << 1);
 if (!$4) return;
 __ZdlPv($4);
 return;
}

function __ZNSt3__26vectorIsNS_9allocatorIsEEE21__push_back_slow_pathIsEEvOT_($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0$i = 0, $11 = 0, $16 = 0, $19 = 0, $2 = 0, $22 = 0, $23 = 0, $29 = 0, $3 = 0, $32 = 0, $4 = 0, $5 = 0, $7 = 0, $9 = 0;
 $2 = $0 + 4 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 $4 = HEAP32[$0 >> 2] | 0;
 $5 = $3 - $4 | 0;
 $7 = ($5 >> 1) + 1 | 0;
 if (($5 | 0) < -2) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $9 = $0 + 8 | 0;
 $11 = (HEAP32[$9 >> 2] | 0) - $4 | 0;
 $$0$i = $11 >> 1 >>> 0 < 1073741823 ? ($11 >>> 0 < $7 >>> 0 ? $7 : $11) : 2147483647;
 $16 = $3 - $4 >> 1;
 do if (!$$0$i) $23 = 0; else if (($$0$i | 0) < 0) {
  $19 = ___cxa_allocate_exception(4) | 0;
  __ZNSt9bad_allocC2Ev($19);
  ___cxa_throw($19 | 0, 424, 6);
 } else {
  $23 = __Znwj($$0$i << 1) | 0;
  break;
 } while (0);
 $22 = $23 + ($16 << 1) | 0;
 HEAP16[$22 >> 1] = HEAP16[$1 >> 1] | 0;
 $29 = $3 - $4 | 0;
 $32 = $22 + (0 - ($29 >> 1) << 1) | 0;
 if (($29 | 0) > 0) _memcpy($32 | 0, $4 | 0, $29 | 0) | 0;
 HEAP32[$0 >> 2] = $32;
 HEAP32[$2 >> 2] = $22 + 2;
 HEAP32[$9 >> 2] = $23 + ($$0$i << 1);
 if (!$4) return;
 __ZdlPv($4);
 return;
}

function _fflush($0) {
 $0 = $0 | 0;
 var $$0 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $25 = 0, $29 = 0, $7 = 0, $phitmp = 0;
 do if (!$0) {
  if (!(HEAP32[2572] | 0)) $29 = 0; else $29 = _fflush(HEAP32[2572] | 0) | 0;
  $$02325 = HEAP32[(___ofl_lock() | 0) >> 2] | 0;
  if (!$$02325) $$024$lcssa = $29; else {
   $$02327 = $$02325;
   $$02426 = $29;
   while (1) {
    if ((HEAP32[$$02327 + 76 >> 2] | 0) > -1) $25 = ___lockfile($$02327) | 0; else $25 = 0;
    if ((HEAP32[$$02327 + 20 >> 2] | 0) >>> 0 > (HEAP32[$$02327 + 28 >> 2] | 0) >>> 0) $$1 = ___fflush_unlocked($$02327) | 0 | $$02426; else $$1 = $$02426;
    if ($25 | 0) ___unlockfile($$02327);
    $$02327 = HEAP32[$$02327 + 56 >> 2] | 0;
    if (!$$02327) {
     $$024$lcssa = $$1;
     break;
    } else $$02426 = $$1;
   }
  }
  ___ofl_unlock();
  $$0 = $$024$lcssa;
 } else {
  if ((HEAP32[$0 + 76 >> 2] | 0) <= -1) {
   $$0 = ___fflush_unlocked($0) | 0;
   break;
  }
  $phitmp = (___lockfile($0) | 0) == 0;
  $7 = ___fflush_unlocked($0) | 0;
  if ($phitmp) $$0 = $7; else {
   ___unlockfile($0);
   $$0 = $7;
  }
 } while (0);
 return $$0 | 0;
}

function _wcrtomb($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0 = 0;
 do if (!$0) $$0 = 1; else {
  if ($1 >>> 0 < 128) {
   HEAP8[$0 >> 0] = $1;
   $$0 = 1;
   break;
  }
  if (!(HEAP32[HEAP32[(_pthread_self() | 0) + 188 >> 2] >> 2] | 0)) if (($1 & -128 | 0) == 57216) {
   HEAP8[$0 >> 0] = $1;
   $$0 = 1;
   break;
  } else {
   HEAP32[(___errno_location() | 0) >> 2] = 84;
   $$0 = -1;
   break;
  }
  if ($1 >>> 0 < 2048) {
   HEAP8[$0 >> 0] = $1 >>> 6 | 192;
   HEAP8[$0 + 1 >> 0] = $1 & 63 | 128;
   $$0 = 2;
   break;
  }
  if ($1 >>> 0 < 55296 | ($1 & -8192 | 0) == 57344) {
   HEAP8[$0 >> 0] = $1 >>> 12 | 224;
   HEAP8[$0 + 1 >> 0] = $1 >>> 6 & 63 | 128;
   HEAP8[$0 + 2 >> 0] = $1 & 63 | 128;
   $$0 = 3;
   break;
  }
  if (($1 + -65536 | 0) >>> 0 < 1048576) {
   HEAP8[$0 >> 0] = $1 >>> 18 | 240;
   HEAP8[$0 + 1 >> 0] = $1 >>> 12 & 63 | 128;
   HEAP8[$0 + 2 >> 0] = $1 >>> 6 & 63 | 128;
   HEAP8[$0 + 3 >> 0] = $1 & 63 | 128;
   $$0 = 4;
   break;
  } else {
   HEAP32[(___errno_location() | 0) >> 2] = 84;
   $$0 = -1;
   break;
  }
 } while (0);
 return $$0 | 0;
}

function __ZNSt3__26vectorIhNS_9allocatorIhEEE9push_backERKh($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0$i$i = 0, $12 = 0, $14 = 0, $16 = 0, $17 = 0, $19 = 0, $2 = 0, $21 = 0, $24 = 0, $25 = 0, $3 = 0, $32 = 0, $4 = 0, $5 = 0, $7 = 0;
 $2 = $0 + 4 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 $4 = $0 + 8 | 0;
 $5 = HEAP32[$4 >> 2] | 0;
 $7 = $3;
 if (($3 | 0) != ($5 | 0)) {
  HEAP8[$3 >> 0] = HEAP8[$1 >> 0] | 0;
  HEAP32[$2 >> 2] = (HEAP32[$2 >> 2] | 0) + 1;
  return;
 }
 $12 = HEAP32[$0 >> 2] | 0;
 $14 = $7 - $12 + 1 | 0;
 if (($14 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $16 = $12;
 $17 = $5 - $12 | 0;
 $19 = $17 << 1;
 $$0$i$i = $17 >>> 0 < 1073741823 ? ($19 >>> 0 < $14 >>> 0 ? $14 : $19) : 2147483647;
 $21 = $7 - $12 | 0;
 if (!$$0$i$i) $25 = 0; else $25 = __Znwj($$0$i$i) | 0;
 $24 = $25 + $21 | 0;
 HEAP8[$24 >> 0] = HEAP8[$1 >> 0] | 0;
 $32 = $24 + (0 - $21) | 0;
 if (($21 | 0) > 0) _memcpy($32 | 0, $16 | 0, $21 | 0) | 0;
 HEAP32[$0 >> 2] = $32;
 HEAP32[$2 >> 2] = $24 + 1;
 HEAP32[$4 >> 2] = $25 + $$0$i$i;
 if (!$12) return;
 __ZdlPv($16);
 return;
}

function _fmt_u($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$010$lcssa$off0 = 0, $$012 = 0, $$09$lcssa = 0, $$0914 = 0, $$1$lcssa = 0, $$111 = 0, $10 = 0, $26 = 0, $8 = 0, $9 = 0, $8$looptemp = 0;
 if ($1 >>> 0 > 0 | ($1 | 0) == 0 & $0 >>> 0 > 4294967295) {
  $$0914 = $2;
  $8 = $0;
  $9 = $1;
  while (1) {
   $10 = ___uremdi3($8 | 0, $9 | 0, 10, 0) | 0;
   $$0914 = $$0914 + -1 | 0;
   HEAP8[$$0914 >> 0] = $10 | 48;
   $8$looptemp = $8;
   $8 = ___udivdi3($8 | 0, $9 | 0, 10, 0) | 0;
   if (!($9 >>> 0 > 9 | ($9 | 0) == 9 & $8$looptemp >>> 0 > 4294967295)) break; else $9 = tempRet0;
  }
  $$010$lcssa$off0 = $8;
  $$09$lcssa = $$0914;
 } else {
  $$010$lcssa$off0 = $0;
  $$09$lcssa = $2;
 }
 if (!$$010$lcssa$off0) $$1$lcssa = $$09$lcssa; else {
  $$012 = $$010$lcssa$off0;
  $$111 = $$09$lcssa;
  while (1) {
   $26 = $$111 + -1 | 0;
   HEAP8[$26 >> 0] = ($$012 >>> 0) % 10 | 0 | 48;
   if ($$012 >>> 0 < 10) {
    $$1$lcssa = $26;
    break;
   } else {
    $$012 = ($$012 >>> 0) / 10 | 0;
    $$111 = $26;
   }
  }
 }
 return $$1$lcssa | 0;
}

function __ZN10emscripten15register_vectorIsEENS_6class_INSt3__26vectorIT_NS2_9allocatorIS4_EEEENS_8internal11NoBaseClassEEEPKc($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 __embind_register_class(104, 128, 144, 0, 11812, 8, 11815, 0, 11815, 0, $1 | 0, 11817, 13);
 __embind_register_class_constructor(104, 1, 700, 11812, 9, 1);
 $2 = __Znwj(8) | 0;
 HEAP32[$2 >> 2] = 1;
 HEAP32[$2 + 4 >> 2] = 0;
 __embind_register_class_function(104, 11820, 3, 704, 11830, 1, $2 | 0, 0);
 $3 = __Znwj(8) | 0;
 HEAP32[$3 >> 2] = 2;
 HEAP32[$3 + 4 >> 2] = 0;
 __embind_register_class_function(104, 11835, 4, 716, 11842, 4, $3 | 0, 0);
 $4 = __Znwj(8) | 0;
 HEAP32[$4 >> 2] = 10;
 HEAP32[$4 + 4 >> 2] = 0;
 __embind_register_class_function(104, 11848, 2, 732, 11853, 12, $4 | 0, 0);
 $5 = __Znwj(4) | 0;
 HEAP32[$5 >> 2] = 13;
 __embind_register_class_function(104, 11857, 3, 740, 11861, 10, $5 | 0, 0);
 $6 = __Znwj(4) | 0;
 HEAP32[$6 >> 2] = 11;
 __embind_register_class_function(104, 11866, 4, 752, 11870, 2, $6 | 0, 0);
 return;
}

function __ZN10emscripten15register_vectorIhEENS_6class_INSt3__26vectorIT_NS2_9allocatorIS4_EEEENS_8internal11NoBaseClassEEEPKc($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 __embind_register_class(8, 32, 48, 0, 11812, 11, 11815, 0, 11815, 0, $1 | 0, 11817, 14);
 __embind_register_class_constructor(8, 1, 632, 11812, 12, 2);
 $2 = __Znwj(8) | 0;
 HEAP32[$2 >> 2] = 2;
 HEAP32[$2 + 4 >> 2] = 0;
 __embind_register_class_function(8, 11820, 3, 636, 11830, 3, $2 | 0, 0);
 $3 = __Znwj(8) | 0;
 HEAP32[$3 >> 2] = 4;
 HEAP32[$3 + 4 >> 2] = 0;
 __embind_register_class_function(8, 11835, 4, 648, 11842, 5, $3 | 0, 0);
 $4 = __Znwj(8) | 0;
 HEAP32[$4 >> 2] = 13;
 HEAP32[$4 + 4 >> 2] = 0;
 __embind_register_class_function(8, 11848, 2, 664, 11853, 14, $4 | 0, 0);
 $5 = __Znwj(4) | 0;
 HEAP32[$5 >> 2] = 15;
 __embind_register_class_function(8, 11857, 3, 672, 11861, 12, $5 | 0, 0);
 $6 = __Znwj(4) | 0;
 HEAP32[$6 >> 2] = 13;
 __embind_register_class_function(8, 11866, 4, 684, 11870, 3, $6 | 0, 0);
 return;
}

function _fputc($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0 = 0, $13 = 0, $14 = 0, $20 = 0, $21 = 0, $26 = 0, $27 = 0, $33 = 0, $7 = 0, $8 = 0, label = 0;
 if ((HEAP32[$1 + 76 >> 2] | 0) < 0) label = 3; else if (!(___lockfile($1) | 0)) label = 3; else {
  $20 = $0 & 255;
  $21 = $0 & 255;
  if (($21 | 0) == (HEAP8[$1 + 75 >> 0] | 0)) label = 10; else {
   $26 = $1 + 20 | 0;
   $27 = HEAP32[$26 >> 2] | 0;
   if ($27 >>> 0 < (HEAP32[$1 + 16 >> 2] | 0) >>> 0) {
    HEAP32[$26 >> 2] = $27 + 1;
    HEAP8[$27 >> 0] = $20;
    $33 = $21;
   } else label = 10;
  }
  if ((label | 0) == 10) $33 = ___overflow($1, $0) | 0;
  ___unlockfile($1);
  $$0 = $33;
 }
 do if ((label | 0) == 3) {
  $7 = $0 & 255;
  $8 = $0 & 255;
  if (($8 | 0) != (HEAP8[$1 + 75 >> 0] | 0)) {
   $13 = $1 + 20 | 0;
   $14 = HEAP32[$13 >> 2] | 0;
   if ($14 >>> 0 < (HEAP32[$1 + 16 >> 2] | 0) >>> 0) {
    HEAP32[$13 >> 2] = $14 + 1;
    HEAP8[$14 >> 0] = $7;
    $$0 = $8;
    break;
   }
  }
  $$0 = ___overflow($1, $0) | 0;
 } while (0);
 return $$0 | 0;
}

function __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($0, $1, $2, $3, $4) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 var $10 = 0, $11 = 0, $21 = 0, $22 = 0, $27 = 0, $30 = 0;
 HEAP8[$1 + 53 >> 0] = 1;
 do if ((HEAP32[$1 + 4 >> 2] | 0) == ($3 | 0)) {
  HEAP8[$1 + 52 >> 0] = 1;
  $10 = $1 + 16 | 0;
  $11 = HEAP32[$10 >> 2] | 0;
  if (!$11) {
   HEAP32[$10 >> 2] = $2;
   HEAP32[$1 + 24 >> 2] = $4;
   HEAP32[$1 + 36 >> 2] = 1;
   if (!(($4 | 0) == 1 ? (HEAP32[$1 + 48 >> 2] | 0) == 1 : 0)) break;
   HEAP8[$1 + 54 >> 0] = 1;
   break;
  }
  if (($11 | 0) != ($2 | 0)) {
   $30 = $1 + 36 | 0;
   HEAP32[$30 >> 2] = (HEAP32[$30 >> 2] | 0) + 1;
   HEAP8[$1 + 54 >> 0] = 1;
   break;
  }
  $21 = $1 + 24 | 0;
  $22 = HEAP32[$21 >> 2] | 0;
  if (($22 | 0) == 2) {
   HEAP32[$21 >> 2] = $4;
   $27 = $4;
  } else $27 = $22;
  if (($27 | 0) == 1 ? (HEAP32[$1 + 48 >> 2] | 0) == 1 : 0) HEAP8[$1 + 54 >> 0] = 1;
 } while (0);
 return;
}

function _pad($0, $1, $2, $3, $4) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 var $$0$lcssa16 = 0, $$012 = 0, $13 = 0, $15 = 0, $16 = 0, $20 = 0, $23 = 0, $24 = 0, $5 = 0, $9 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256 | 0;
 $5 = sp;
 do if (($2 | 0) > ($3 | 0) & ($4 & 73728 | 0) == 0) {
  $9 = $2 - $3 | 0;
  _memset($5 | 0, $1 | 0, ($9 >>> 0 > 256 ? 256 : $9) | 0) | 0;
  $13 = HEAP32[$0 >> 2] | 0;
  $15 = ($13 & 32 | 0) == 0;
  if ($9 >>> 0 > 255) {
   $16 = $2 - $3 | 0;
   $$012 = $9;
   $23 = $13;
   $24 = $15;
   while (1) {
    if ($24) {
     ___fwritex($5, 256, $0) | 0;
     $20 = HEAP32[$0 >> 2] | 0;
    } else $20 = $23;
    $$012 = $$012 + -256 | 0;
    $24 = ($20 & 32 | 0) == 0;
    if ($$012 >>> 0 <= 255) break; else $23 = $20;
   }
   if ($24) $$0$lcssa16 = $16 & 255; else break;
  } else if ($15) $$0$lcssa16 = $9; else break;
  ___fwritex($5, $$0$lcssa16, $0) | 0;
 } while (0);
 STACKTOP = sp;
 return;
}

function _strlen($0) {
 $0 = $0 | 0;
 var $$0 = 0, $$015$lcssa = 0, $$01518 = 0, $$1$lcssa = 0, $$pn = 0, $$pn29 = 0, $1 = 0, $10 = 0, $19 = 0, $22 = 0, $6 = 0, label = 0;
 $1 = $0;
 L1 : do if (!($1 & 3)) {
  $$015$lcssa = $0;
  label = 4;
 } else {
  $$01518 = $0;
  $22 = $1;
  while (1) {
   if (!(HEAP8[$$01518 >> 0] | 0)) {
    $$pn = $22;
    break L1;
   }
   $6 = $$01518 + 1 | 0;
   $22 = $6;
   if (!($22 & 3)) {
    $$015$lcssa = $6;
    label = 4;
    break;
   } else $$01518 = $6;
  }
 } while (0);
 if ((label | 0) == 4) {
  $$0 = $$015$lcssa;
  while (1) {
   $10 = HEAP32[$$0 >> 2] | 0;
   if (!(($10 & -2139062144 ^ -2139062144) & $10 + -16843009)) $$0 = $$0 + 4 | 0; else break;
  }
  if (!(($10 & 255) << 24 >> 24)) $$1$lcssa = $$0; else {
   $$pn29 = $$0;
   while (1) {
    $19 = $$pn29 + 1 | 0;
    if (!(HEAP8[$19 >> 0] | 0)) {
     $$1$lcssa = $19;
     break;
    } else $$pn29 = $19;
   }
  }
  $$pn = $$1$lcssa;
 }
 return $$pn - $1 | 0;
}

function __tr_flush_bits($0) {
 $0 = $0 | 0;
 var $1 = 0, $10 = 0, $15 = 0, $16 = 0, $2 = 0, $21 = 0, $23 = 0, $24 = 0, $25 = 0, $4 = 0, $6 = 0, $7 = 0, $8 = 0;
 $1 = $0 + 5820 | 0;
 $2 = HEAP32[$1 >> 2] | 0;
 if (($2 | 0) == 16) {
  $4 = $0 + 5816 | 0;
  $6 = HEAP16[$4 >> 1] & 255;
  $7 = $0 + 20 | 0;
  $8 = HEAP32[$7 >> 2] | 0;
  HEAP32[$7 >> 2] = $8 + 1;
  $10 = $0 + 8 | 0;
  HEAP8[(HEAP32[$10 >> 2] | 0) + $8 >> 0] = $6;
  $15 = (HEAPU16[$4 >> 1] | 0) >>> 8 & 255;
  $16 = HEAP32[$7 >> 2] | 0;
  HEAP32[$7 >> 2] = $16 + 1;
  HEAP8[(HEAP32[$10 >> 2] | 0) + $16 >> 0] = $15;
  HEAP16[$4 >> 1] = 0;
  HEAP32[$1 >> 2] = 0;
  return;
 }
 if (($2 | 0) <= 7) return;
 $21 = $0 + 5816 | 0;
 $23 = HEAP16[$21 >> 1] & 255;
 $24 = $0 + 20 | 0;
 $25 = HEAP32[$24 >> 2] | 0;
 HEAP32[$24 >> 2] = $25 + 1;
 HEAP8[(HEAP32[$0 + 8 >> 2] | 0) + $25 >> 0] = $23;
 HEAP16[$21 >> 1] = (HEAPU16[$21 >> 1] | 0) >>> 8;
 HEAP32[$1 >> 2] = (HEAP32[$1 >> 2] | 0) + -8;
 return;
}

function __ZNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEEC2ERKS5_($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$07$i$i = 0, $11 = 0, $14 = 0, $15 = 0, $17 = 0, $2 = 0, $4 = 0, $7 = 0, $8 = 0;
 HEAP32[$0 >> 2] = 0;
 $2 = $0 + 4 | 0;
 HEAP32[$2 >> 2] = 0;
 HEAP32[$0 + 8 >> 2] = 0;
 $4 = $1 + 4 | 0;
 $7 = (HEAP32[$4 >> 2] | 0) - (HEAP32[$1 >> 2] | 0) | 0;
 $8 = ($7 | 0) / 12 | 0;
 if (!$7) return;
 if ($8 >>> 0 > 357913941) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $11 = __Znwj($7) | 0;
 HEAP32[$2 >> 2] = $11;
 HEAP32[$0 >> 2] = $11;
 HEAP32[$0 + 8 >> 2] = $11 + ($8 * 12 | 0);
 $14 = HEAP32[$1 >> 2] | 0;
 $15 = HEAP32[$4 >> 2] | 0;
 if (($14 | 0) == ($15 | 0)) return;
 $$07$i$i = $14;
 $17 = $11;
 do {
  __ZNSt3__26vectorIsNS_9allocatorIsEEEC2ERKS3_($17, $$07$i$i);
  $$07$i$i = $$07$i$i + 12 | 0;
  $17 = (HEAP32[$2 >> 2] | 0) + 12 | 0;
  HEAP32[$2 >> 2] = $17;
 } while (($$07$i$i | 0) != ($15 | 0));
 return;
}

function __ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$0 = 0, $$2 = 0, $3 = 0, $6 = 0, dest = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64 | 0;
 $3 = sp;
 if (($0 | 0) == ($1 | 0)) $$2 = 1; else if (!$1) $$2 = 0; else {
  $6 = ___dynamic_cast($1, 384, 368, 0) | 0;
  if (!$6) $$2 = 0; else {
   dest = $3 + 4 | 0;
   stop = dest + 52 | 0;
   do {
    HEAP32[dest >> 2] = 0;
    dest = dest + 4 | 0;
   } while ((dest | 0) < (stop | 0));
   HEAP32[$3 >> 2] = $6;
   HEAP32[$3 + 8 >> 2] = $0;
   HEAP32[$3 + 12 >> 2] = -1;
   HEAP32[$3 + 48 >> 2] = 1;
   FUNCTION_TABLE_viiii[HEAP32[(HEAP32[$6 >> 2] | 0) + 28 >> 2] & 7]($6, $3, HEAP32[$2 >> 2] | 0, 1);
   if ((HEAP32[$3 + 24 >> 2] | 0) == 1) {
    HEAP32[$2 >> 2] = HEAP32[$3 + 16 >> 2];
    $$0 = 1;
   } else $$0 = 0;
   $$2 = $$0;
  }
 }
 STACKTOP = sp;
 return $$2 | 0;
}

function __ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0, $1, $2, $3, $4) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 var $11 = 0, $19 = 0, $25 = 0;
 do if (($0 | 0) == (HEAP32[$1 + 8 >> 2] | 0)) {
  if ((HEAP32[$1 + 4 >> 2] | 0) == ($2 | 0)) {
   $11 = $1 + 28 | 0;
   if ((HEAP32[$11 >> 2] | 0) != 1) HEAP32[$11 >> 2] = $3;
  }
 } else if (($0 | 0) == (HEAP32[$1 >> 2] | 0)) {
  if ((HEAP32[$1 + 16 >> 2] | 0) != ($2 | 0)) {
   $19 = $1 + 20 | 0;
   if ((HEAP32[$19 >> 2] | 0) != ($2 | 0)) {
    HEAP32[$1 + 32 >> 2] = $3;
    HEAP32[$19 >> 2] = $2;
    $25 = $1 + 40 | 0;
    HEAP32[$25 >> 2] = (HEAP32[$25 >> 2] | 0) + 1;
    if ((HEAP32[$1 + 36 >> 2] | 0) == 1) if ((HEAP32[$1 + 24 >> 2] | 0) == 2) HEAP8[$1 + 54 >> 0] = 1;
    HEAP32[$1 + 44 >> 2] = 4;
    break;
   }
  }
  if (($3 | 0) == 1) HEAP32[$1 + 32 >> 2] = 1;
 } while (0);
 return;
}

function __ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $$0 = 0, $10 = 0, $13 = 0, $9 = 0;
 L1 : do if (($0 | 0) == (HEAP32[$1 + 8 >> 2] | 0)) __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0, $1, $2, $3); else {
  $9 = HEAP32[$0 + 12 >> 2] | 0;
  $10 = $0 + 16 + ($9 << 3) | 0;
  __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0 + 16 | 0, $1, $2, $3);
  if (($9 | 0) > 1) {
   $13 = $1 + 54 | 0;
   $$0 = $0 + 24 | 0;
   do {
    __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($$0, $1, $2, $3);
    if (HEAP8[$13 >> 0] | 0) break L1;
    $$0 = $$0 + 8 | 0;
   } while ($$0 >>> 0 < $10 >>> 0);
  }
 } while (0);
 return;
}

function ___strerror_l($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$012$lcssa = 0, $$01214 = 0, $$016 = 0, $$113 = 0, $$115 = 0, $7 = 0, label = 0, $$113$looptemp = 0;
 $$016 = 0;
 while (1) {
  if ((HEAPU8[15333 + $$016 >> 0] | 0) == ($0 | 0)) {
   label = 2;
   break;
  }
  $7 = $$016 + 1 | 0;
  if (($7 | 0) == 87) {
   $$01214 = 15421;
   $$115 = 87;
   label = 5;
   break;
  } else $$016 = $7;
 }
 if ((label | 0) == 2) if (!$$016) $$012$lcssa = 15421; else {
  $$01214 = 15421;
  $$115 = $$016;
  label = 5;
 }
 if ((label | 0) == 5) while (1) {
  label = 0;
  $$113 = $$01214;
  do {
   $$113$looptemp = $$113;
   $$113 = $$113 + 1 | 0;
  } while ((HEAP8[$$113$looptemp >> 0] | 0) != 0);
  $$115 = $$115 + -1 | 0;
  if (!$$115) {
   $$012$lcssa = $$113;
   break;
  } else {
   $$01214 = $$113;
   label = 5;
  }
 }
 return ___lctrans($$012$lcssa, HEAP32[$1 + 20 >> 2] | 0) | 0;
}

function ___overflow($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0 = 0, $10 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $2 = sp;
 $3 = $1 & 255;
 HEAP8[$2 >> 0] = $3;
 $4 = $0 + 16 | 0;
 $5 = HEAP32[$4 >> 2] | 0;
 if (!$5) if (!(___towrite($0) | 0)) {
  $12 = HEAP32[$4 >> 2] | 0;
  label = 4;
 } else $$0 = -1; else {
  $12 = $5;
  label = 4;
 }
 do if ((label | 0) == 4) {
  $9 = $0 + 20 | 0;
  $10 = HEAP32[$9 >> 2] | 0;
  if ($10 >>> 0 < $12 >>> 0) {
   $13 = $1 & 255;
   if (($13 | 0) != (HEAP8[$0 + 75 >> 0] | 0)) {
    HEAP32[$9 >> 2] = $10 + 1;
    HEAP8[$10 >> 0] = $3;
    $$0 = $13;
    break;
   }
  }
  if ((FUNCTION_TABLE_iiii[HEAP32[$0 + 36 >> 2] & 15]($0, $2, 1) | 0) == 1) $$0 = HEAPU8[$2 >> 0] | 0; else $$0 = -1;
 } while (0);
 STACKTOP = sp;
 return $$0 | 0;
}

function _frexp($0, $1) {
 $0 = +$0;
 $1 = $1 | 0;
 var $$0 = 0.0, $$016 = 0.0, $2 = 0, $3 = 0, $4 = 0, $9 = 0.0, $storemerge = 0;
 HEAPF64[tempDoublePtr >> 3] = $0;
 $2 = HEAP32[tempDoublePtr >> 2] | 0;
 $3 = HEAP32[tempDoublePtr + 4 >> 2] | 0;
 $4 = _bitshift64Lshr($2 | 0, $3 | 0, 52) | 0;
 switch ($4 & 2047) {
 case 0:
  {
   if ($0 != 0.0) {
    $9 = +_frexp($0 * 18446744073709551616.0, $1);
    $$016 = $9;
    $storemerge = (HEAP32[$1 >> 2] | 0) + -64 | 0;
   } else {
    $$016 = $0;
    $storemerge = 0;
   }
   HEAP32[$1 >> 2] = $storemerge;
   $$0 = $$016;
   break;
  }
 case 2047:
  {
   $$0 = $0;
   break;
  }
 default:
  {
   HEAP32[$1 >> 2] = ($4 & 2047) + -1022;
   HEAP32[tempDoublePtr >> 2] = $2;
   HEAP32[tempDoublePtr + 4 >> 2] = $3 & -2146435073 | 1071644672;
   $$0 = +HEAPF64[tempDoublePtr >> 3];
  }
 }
 return +$$0;
}

function __Z12decodeImageWNSt3__210unique_ptrINS_6vectorIsNS_9allocatorIsEEEENS_14default_deleteIS4_EEEE($0) {
 $0 = $0 | 0;
 var $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $6 = 0, $8 = 0, $9 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $1 = sp;
 $2 = HEAP32[$0 >> 2] | 0;
 HEAP32[$0 >> 2] = 0;
 HEAP32[$1 >> 2] = $2;
 $3 = $2;
 $4 = __Z11decodeImageNSt3__210unique_ptrINS_6vectorIsNS_9allocatorIsEEEENS_14default_deleteIS4_EEEEPjS8_($1, 0, 0) | 0;
 HEAP32[$1 >> 2] = 0;
 if (!$2) {
  STACKTOP = sp;
  return $4 | 0;
 }
 $6 = HEAP32[$3 >> 2] | 0;
 $8 = $6;
 if ($6 | 0) {
  $9 = $3 + 4 | 0;
  $10 = HEAP32[$9 >> 2] | 0;
  if (($10 | 0) != ($6 | 0)) HEAP32[$9 >> 2] = $10 + (~(($10 + -2 - $8 | 0) >>> 1) << 1);
  __ZdlPv($6);
 }
 __ZdlPv($2);
 STACKTOP = sp;
 return $4 | 0;
}

function __ZN10emscripten8internal7InvokerINSt3__210unique_ptrINS2_6vectorIhNS2_9allocatorIhEEEENS2_14default_deleteIS7_EEEEJNS3_INS4_IsNS5_IsEEEENS8_ISC_EEEEEE6invokeEPFSA_SE_EPSC_($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $10 = 0, $2 = 0, $3 = 0, $4 = 0, $6 = 0, $8 = 0, $9 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $2 = sp;
 HEAP32[$2 >> 2] = $1;
 $3 = FUNCTION_TABLE_ii[$0 & 15]($2) | 0;
 $4 = HEAP32[$2 >> 2] | 0;
 HEAP32[$2 >> 2] = 0;
 if (!$4) {
  STACKTOP = sp;
  return $3 | 0;
 }
 $6 = HEAP32[$4 >> 2] | 0;
 $8 = $6;
 if ($6 | 0) {
  $9 = $4 + 4 | 0;
  $10 = HEAP32[$9 >> 2] | 0;
  if (($10 | 0) != ($6 | 0)) HEAP32[$9 >> 2] = $10 + (~(($10 + -2 - $8 | 0) >>> 1) << 1);
  __ZdlPv($6);
 }
 __ZdlPv($4);
 STACKTOP = sp;
 return $3 | 0;
}

function __ZNSt3__26vectorIfNS_9allocatorIfEEEC2ERKS3_($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $11 = 0, $14 = 0, $17 = 0, $2 = 0, $4 = 0, $7 = 0, $8 = 0;
 HEAP32[$0 >> 2] = 0;
 $2 = $0 + 4 | 0;
 HEAP32[$2 >> 2] = 0;
 HEAP32[$0 + 8 >> 2] = 0;
 $4 = $1 + 4 | 0;
 $7 = (HEAP32[$4 >> 2] | 0) - (HEAP32[$1 >> 2] | 0) | 0;
 $8 = $7 >> 2;
 if (!$8) return;
 if ($8 >>> 0 > 1073741823) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $11 = __Znwj($7) | 0;
 HEAP32[$2 >> 2] = $11;
 HEAP32[$0 >> 2] = $11;
 HEAP32[$0 + 8 >> 2] = $11 + ($8 << 2);
 $14 = HEAP32[$1 >> 2] | 0;
 $17 = (HEAP32[$4 >> 2] | 0) - $14 | 0;
 if (($17 | 0) <= 0) return;
 _memcpy($11 | 0, $14 | 0, $17 | 0) | 0;
 HEAP32[$2 >> 2] = $11 + ($17 >> 2 << 2);
 return;
}

function ___fflush_unlocked($0) {
 $0 = $0 | 0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $3 = 0, label = 0;
 $1 = $0 + 20 | 0;
 $3 = $0 + 28 | 0;
 if ((HEAP32[$1 >> 2] | 0) >>> 0 > (HEAP32[$3 >> 2] | 0) >>> 0) {
  FUNCTION_TABLE_iiii[HEAP32[$0 + 36 >> 2] & 15]($0, 0, 0) | 0;
  if (!(HEAP32[$1 >> 2] | 0)) $$0 = -1; else label = 3;
 } else label = 3;
 if ((label | 0) == 3) {
  $10 = $0 + 4 | 0;
  $11 = HEAP32[$10 >> 2] | 0;
  $12 = $0 + 8 | 0;
  $13 = HEAP32[$12 >> 2] | 0;
  if ($11 >>> 0 < $13 >>> 0) FUNCTION_TABLE_iiii[HEAP32[$0 + 40 >> 2] & 15]($0, $11 - $13 | 0, 1) | 0;
  HEAP32[$0 + 16 >> 2] = 0;
  HEAP32[$3 >> 2] = 0;
  HEAP32[$1 >> 2] = 0;
  HEAP32[$12 >> 2] = 0;
  HEAP32[$10 >> 2] = 0;
  $$0 = 0;
 }
 return $$0 | 0;
}

function __ZNSt3__26vectorIsNS_9allocatorIsEEEC2ERKS3_($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $11 = 0, $14 = 0, $17 = 0, $2 = 0, $4 = 0, $7 = 0, $8 = 0;
 HEAP32[$0 >> 2] = 0;
 $2 = $0 + 4 | 0;
 HEAP32[$2 >> 2] = 0;
 HEAP32[$0 + 8 >> 2] = 0;
 $4 = $1 + 4 | 0;
 $7 = (HEAP32[$4 >> 2] | 0) - (HEAP32[$1 >> 2] | 0) | 0;
 $8 = $7 >> 1;
 if (!$8) return;
 if (($7 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $11 = __Znwj($7) | 0;
 HEAP32[$2 >> 2] = $11;
 HEAP32[$0 >> 2] = $11;
 HEAP32[$0 + 8 >> 2] = $11 + ($8 << 1);
 $14 = HEAP32[$1 >> 2] | 0;
 $17 = (HEAP32[$4 >> 2] | 0) - $14 | 0;
 if (($17 | 0) <= 0) return;
 _memcpy($11 | 0, $14 | 0, $17 | 0) | 0;
 HEAP32[$2 >> 2] = $11 + ($17 >> 1 << 1);
 return;
}

function __Z6encodeRNSt3__26vectorIsNS_9allocatorIsEEEE($0) {
 $0 = $0 | 0;
 var $$sroa$014$023 = 0, $1 = 0, $4 = 0, $6 = 0;
 $1 = __Znwj(12) | 0;
 HEAP32[$1 >> 2] = 0;
 HEAP32[$1 + 4 >> 2] = 0;
 HEAP32[$1 + 8 >> 2] = 0;
 $4 = HEAP32[$0 >> 2] | 0;
 $6 = HEAP32[$0 + 4 >> 2] | 0;
 if (($4 | 0) == ($6 | 0)) {
  __Z11encodeShortRNSt3__26vectorIbNS_9allocatorIbEEEEs($1, 1362) | 0;
  return $1 | 0;
 } else $$sroa$014$023 = $4;
 do {
  __Z11encodeShortRNSt3__26vectorIbNS_9allocatorIbEEEEs($1, HEAP16[$$sroa$014$023 >> 1] | 0) | 0;
  $$sroa$014$023 = $$sroa$014$023 + 2 | 0;
 } while (($$sroa$014$023 | 0) != ($6 | 0));
 __Z11encodeShortRNSt3__26vectorIbNS_9allocatorIbEEEEs($1, 1362) | 0;
 return $1 | 0;
}

function __ZN38EmscriptenBindingInitializer_my_moduleC2Ev($0) {
 $0 = $0 | 0;
 __embind_register_function(12242, 2, 768, 11853, 4, 4);
 __embind_register_function(12251, 4, 776, 11870, 1, 7);
 __embind_register_function(12263, 2, 792, 11853, 5, 5);
 __embind_register_function(12275, 2, 800, 11853, 6, 6);
 __embind_register_function(12289, 2, 800, 11853, 6, 7);
 __embind_register_function(12304, 3, 808, 11861, 8, 7);
 __embind_register_function(12320, 3, 808, 11861, 8, 8);
 __embind_register_function(12337, 3, 820, 11861, 9, 9);
 __embind_register_function(12347, 3, 820, 11861, 9, 10);
 __embind_register_function(12358, 3, 820, 11861, 9, 11);
 return;
}

function __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $10 = 0, $13 = 0, $4 = 0, $5 = 0;
 $4 = $1 + 16 | 0;
 $5 = HEAP32[$4 >> 2] | 0;
 do if (!$5) {
  HEAP32[$4 >> 2] = $2;
  HEAP32[$1 + 24 >> 2] = $3;
  HEAP32[$1 + 36 >> 2] = 1;
 } else {
  if (($5 | 0) != ($2 | 0)) {
   $13 = $1 + 36 | 0;
   HEAP32[$13 >> 2] = (HEAP32[$13 >> 2] | 0) + 1;
   HEAP32[$1 + 24 >> 2] = 2;
   HEAP8[$1 + 54 >> 0] = 1;
   break;
  }
  $10 = $1 + 24 | 0;
  if ((HEAP32[$10 >> 2] | 0) == 2) HEAP32[$10 >> 2] = $3;
 } while (0);
 return;
}

function _sbrk(increment) {
 increment = increment | 0;
 var oldDynamicTop = 0, newDynamicTop = 0;
 increment = increment + 15 & -16 | 0;
 oldDynamicTop = HEAP32[DYNAMICTOP_PTR >> 2] | 0;
 newDynamicTop = oldDynamicTop + increment | 0;
 if ((increment | 0) > 0 & (newDynamicTop | 0) < (oldDynamicTop | 0) | (newDynamicTop | 0) < 0) {
  abortOnCannotGrowMemory() | 0;
  ___setErrNo(12);
  return -1;
 }
 HEAP32[DYNAMICTOP_PTR >> 2] = newDynamicTop;
 if ((newDynamicTop | 0) > (getTotalMemory() | 0)) if (!(enlargeMemory() | 0)) {
  ___setErrNo(12);
  HEAP32[DYNAMICTOP_PTR >> 2] = oldDynamicTop;
  return -1;
 }
 return oldDynamicTop | 0;
}

function __ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIsNS2_9allocatorIsEEEEFvjRKsEvPS6_JjS8_EE6invokeERKSA_SB_js($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $$unpack = 0, $$unpack4 = 0, $13 = 0, $4 = 0, $6 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $4 = sp;
 $$unpack = HEAP32[$0 >> 2] | 0;
 $$unpack4 = HEAP32[$0 + 4 >> 2] | 0;
 $6 = $1 + ($$unpack4 >> 1) | 0;
 if (!($$unpack4 & 1)) $13 = $$unpack; else $13 = HEAP32[(HEAP32[$6 >> 2] | 0) + $$unpack >> 2] | 0;
 HEAP16[$4 >> 1] = $3;
 FUNCTION_TABLE_viii[$13 & 7]($6, $2, $4);
 STACKTOP = sp;
 return;
}

function __ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIhNS2_9allocatorIhEEEEFvjRKhEvPS6_JjS8_EE6invokeERKSA_SB_jh($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $$unpack = 0, $$unpack4 = 0, $13 = 0, $4 = 0, $6 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $4 = sp;
 $$unpack = HEAP32[$0 >> 2] | 0;
 $$unpack4 = HEAP32[$0 + 4 >> 2] | 0;
 $6 = $1 + ($$unpack4 >> 1) | 0;
 if (!($$unpack4 & 1)) $13 = $$unpack; else $13 = HEAP32[(HEAP32[$6 >> 2] | 0) + $$unpack >> 2] | 0;
 HEAP8[$4 >> 0] = $3;
 FUNCTION_TABLE_viii[$13 & 7]($6, $2, $4);
 STACKTOP = sp;
 return;
}

function _strcmp($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$011 = 0, $$0710 = 0, $$lcssa = 0, $$lcssa8 = 0, $2 = 0, $3 = 0, $8 = 0, $9 = 0;
 $2 = HEAP8[$0 >> 0] | 0;
 $3 = HEAP8[$1 >> 0] | 0;
 if ($2 << 24 >> 24 == 0 ? 1 : $2 << 24 >> 24 != $3 << 24 >> 24) {
  $$lcssa = $3;
  $$lcssa8 = $2;
 } else {
  $$011 = $1;
  $$0710 = $0;
  do {
   $$0710 = $$0710 + 1 | 0;
   $$011 = $$011 + 1 | 0;
   $8 = HEAP8[$$0710 >> 0] | 0;
   $9 = HEAP8[$$011 >> 0] | 0;
  } while (!($8 << 24 >> 24 == 0 ? 1 : $8 << 24 >> 24 != $9 << 24 >> 24));
  $$lcssa = $9;
  $$lcssa8 = $8;
 }
 return ($$lcssa8 & 255) - ($$lcssa & 255) | 0;
}

function ___stdio_seek($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $10 = 0, $3 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32 | 0;
 $vararg_buffer = sp;
 $3 = sp + 20 | 0;
 HEAP32[$vararg_buffer >> 2] = HEAP32[$0 + 60 >> 2];
 HEAP32[$vararg_buffer + 4 >> 2] = 0;
 HEAP32[$vararg_buffer + 8 >> 2] = $1;
 HEAP32[$vararg_buffer + 12 >> 2] = $3;
 HEAP32[$vararg_buffer + 16 >> 2] = $2;
 if ((___syscall_ret(___syscall140(140, $vararg_buffer | 0) | 0) | 0) < 0) {
  HEAP32[$3 >> 2] = -1;
  $10 = -1;
 } else $10 = HEAP32[$3 >> 2] | 0;
 STACKTOP = sp;
 return $10 | 0;
}

function __ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIsNS2_9allocatorIsEEEEFvRKsEvPS6_JS8_EE6invokeERKSA_SB_s($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$unpack = 0, $$unpack3 = 0, $12 = 0, $3 = 0, $5 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $3 = sp;
 $$unpack = HEAP32[$0 >> 2] | 0;
 $$unpack3 = HEAP32[$0 + 4 >> 2] | 0;
 $5 = $1 + ($$unpack3 >> 1) | 0;
 if (!($$unpack3 & 1)) $12 = $$unpack; else $12 = HEAP32[(HEAP32[$5 >> 2] | 0) + $$unpack >> 2] | 0;
 HEAP16[$3 >> 1] = $2;
 FUNCTION_TABLE_vii[$12 & 3]($5, $3);
 STACKTOP = sp;
 return;
}

function __ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIhNS2_9allocatorIhEEEEFvRKhEvPS6_JS8_EE6invokeERKSA_SB_h($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $$unpack = 0, $$unpack3 = 0, $12 = 0, $3 = 0, $5 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $3 = sp;
 $$unpack = HEAP32[$0 >> 2] | 0;
 $$unpack3 = HEAP32[$0 + 4 >> 2] | 0;
 $5 = $1 + ($$unpack3 >> 1) | 0;
 if (!($$unpack3 & 1)) $12 = $$unpack; else $12 = HEAP32[(HEAP32[$5 >> 2] | 0) + $$unpack >> 2] | 0;
 HEAP8[$3 >> 0] = $2;
 FUNCTION_TABLE_vii[$12 & 3]($5, $3);
 STACKTOP = sp;
 return;
}

function __ZNSt3__26vectorIsNS_9allocatorIsEEE6resizeEjRKs($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $10 = 0, $13 = 0, $3 = 0, $4 = 0, $5 = 0, $7 = 0;
 $3 = $0 + 4 | 0;
 $4 = HEAP32[$3 >> 2] | 0;
 $5 = HEAP32[$0 >> 2] | 0;
 $7 = $4 - $5 >> 1;
 $10 = $4;
 if ($7 >>> 0 < $1 >>> 0) {
  __ZNSt3__26vectorIsNS_9allocatorIsEEE8__appendEjRKs($0, $1 - $7 | 0, $2);
  return;
 }
 if ($7 >>> 0 <= $1 >>> 0) return;
 $13 = $5 + ($1 << 1) | 0;
 if (($10 | 0) == ($13 | 0)) return;
 HEAP32[$3 >> 2] = $10 + (~(($10 + -2 - $13 | 0) >>> 1) << 1);
 return;
}

function __ZNSt3__26vectorINS0_INS0_IsNS_9allocatorIsEEEENS1_IS3_EEEENS1_IS5_EEEC2Ej($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $6 = 0, $7 = 0, $8 = 0;
 HEAP32[$0 >> 2] = 0;
 $2 = $0 + 4 | 0;
 HEAP32[$2 >> 2] = 0;
 HEAP32[$0 + 8 >> 2] = 0;
 if (!$1) return;
 if ($1 >>> 0 > 357913941) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $6 = $1 * 12 | 0;
 $7 = __Znwj($6) | 0;
 HEAP32[$0 >> 2] = $7;
 $8 = $7 + ($1 * 12 | 0) | 0;
 HEAP32[$0 + 8 >> 2] = $8;
 _memset($7 | 0, 0, $6 | 0) | 0;
 HEAP32[$2 >> 2] = $8;
 return;
}

function ___stdout_write($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $14 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32 | 0;
 $vararg_buffer = sp;
 HEAP32[$0 + 36 >> 2] = 1;
 if (!(HEAP32[$0 >> 2] & 64)) {
  HEAP32[$vararg_buffer >> 2] = HEAP32[$0 + 60 >> 2];
  HEAP32[$vararg_buffer + 4 >> 2] = 21523;
  HEAP32[$vararg_buffer + 8 >> 2] = sp + 16;
  if (___syscall54(54, $vararg_buffer | 0) | 0) HEAP8[$0 + 75 >> 0] = -1;
 }
 $14 = ___stdio_write($0, $1, $2) | 0;
 STACKTOP = sp;
 return $14 | 0;
}

function __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0, $1, $2, $3, $4, $5) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 $5 = $5 | 0;
 var $$0 = 0, $14 = 0, $7 = 0, $8 = 0;
 $7 = HEAP32[$0 + 4 >> 2] | 0;
 $8 = $7 >> 8;
 if (!($7 & 1)) $$0 = $8; else $$0 = HEAP32[(HEAP32[$3 >> 2] | 0) + $8 >> 2] | 0;
 $14 = HEAP32[$0 >> 2] | 0;
 FUNCTION_TABLE_viiiiii[HEAP32[(HEAP32[$14 >> 2] | 0) + 20 >> 2] & 3]($14, $1, $2, $3 + $$0 | 0, $7 & 2 | 0 ? $4 : 2, $5);
 return;
}

function __ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0, $1, $2, $3, $4, $5) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 $5 = $5 | 0;
 var $10 = 0;
 if (($0 | 0) == (HEAP32[$1 + 8 >> 2] | 0)) __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0, $1, $2, $3, $4); else {
  $10 = HEAP32[$0 + 8 >> 2] | 0;
  FUNCTION_TABLE_viiiiii[HEAP32[(HEAP32[$10 >> 2] | 0) + 20 >> 2] & 3]($10, $1, $2, $3, $4, $5);
 }
 return;
}

function __ZNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEEC2Ej($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $6 = 0, $7 = 0, $8 = 0;
 HEAP32[$0 >> 2] = 0;
 $2 = $0 + 4 | 0;
 HEAP32[$2 >> 2] = 0;
 HEAP32[$0 + 8 >> 2] = 0;
 if (!$1) return;
 if ($1 >>> 0 > 357913941) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $6 = $1 * 12 | 0;
 $7 = __Znwj($6) | 0;
 HEAP32[$0 >> 2] = $7;
 $8 = $7 + ($1 * 12 | 0) | 0;
 HEAP32[$0 + 8 >> 2] = $8;
 _memset($7 | 0, 0, $6 | 0) | 0;
 HEAP32[$2 >> 2] = $8;
 return;
}

function __ZN10emscripten8internal12VectorAccessINSt3__26vectorIsNS2_9allocatorIsEEEEE3getERKS6_j($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$sroa$0$0 = 0, $2 = 0, $5 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $2 = sp;
 $5 = HEAP32[$0 >> 2] | 0;
 if ((HEAP32[$0 + 4 >> 2] | 0) - $5 >> 1 >>> 0 <= $1 >>> 0) {
  $$sroa$0$0 = 1;
  STACKTOP = sp;
  return $$sroa$0$0 | 0;
 }
 HEAP32[$2 >> 2] = HEAP16[$5 + ($1 << 1) >> 1];
 $$sroa$0$0 = __emval_take_value(552, $2 | 0) | 0;
 STACKTOP = sp;
 return $$sroa$0$0 | 0;
}

function __ZN10emscripten8internal12VectorAccessINSt3__26vectorIhNS2_9allocatorIhEEEEE3getERKS6_j($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$sroa$0$0 = 0, $2 = 0, $5 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $2 = sp;
 $5 = HEAP32[$0 >> 2] | 0;
 if (((HEAP32[$0 + 4 >> 2] | 0) - $5 | 0) >>> 0 <= $1 >>> 0) {
  $$sroa$0$0 = 1;
  STACKTOP = sp;
  return $$sroa$0$0 | 0;
 }
 HEAP32[$2 >> 2] = HEAPU8[$5 + $1 >> 0];
 $$sroa$0$0 = __emval_take_value(536, $2 | 0) | 0;
 STACKTOP = sp;
 return $$sroa$0$0 | 0;
}

function __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0, $1, $2, $3, $4) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 var $$0 = 0, $13 = 0, $6 = 0, $7 = 0;
 $6 = HEAP32[$0 + 4 >> 2] | 0;
 $7 = $6 >> 8;
 if (!($6 & 1)) $$0 = $7; else $$0 = HEAP32[(HEAP32[$2 >> 2] | 0) + $7 >> 2] | 0;
 $13 = HEAP32[$0 >> 2] | 0;
 FUNCTION_TABLE_viiiii[HEAP32[(HEAP32[$13 >> 2] | 0) + 24 >> 2] & 3]($13, $1, $2 + $$0 | 0, $6 & 2 | 0 ? $3 : 2, $4);
 return;
}

function __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $$0 = 0, $12 = 0, $5 = 0, $6 = 0;
 $5 = HEAP32[$0 + 4 >> 2] | 0;
 $6 = $5 >> 8;
 if (!($5 & 1)) $$0 = $6; else $$0 = HEAP32[(HEAP32[$2 >> 2] | 0) + $6 >> 2] | 0;
 $12 = HEAP32[$0 >> 2] | 0;
 FUNCTION_TABLE_viiii[HEAP32[(HEAP32[$12 >> 2] | 0) + 28 >> 2] & 7]($12, $1, $2 + $$0 | 0, $5 & 2 | 0 ? $3 : 2);
 return;
}

function ___towrite($0) {
 $0 = $0 | 0;
 var $$0 = 0, $1 = 0, $14 = 0, $3 = 0, $7 = 0;
 $1 = $0 + 74 | 0;
 $3 = HEAP8[$1 >> 0] | 0;
 HEAP8[$1 >> 0] = $3 + 255 | $3;
 $7 = HEAP32[$0 >> 2] | 0;
 if (!($7 & 8)) {
  HEAP32[$0 + 8 >> 2] = 0;
  HEAP32[$0 + 4 >> 2] = 0;
  $14 = HEAP32[$0 + 44 >> 2] | 0;
  HEAP32[$0 + 28 >> 2] = $14;
  HEAP32[$0 + 20 >> 2] = $14;
  HEAP32[$0 + 16 >> 2] = $14 + (HEAP32[$0 + 48 >> 2] | 0);
  $$0 = 0;
 } else {
  HEAP32[$0 >> 2] = $7 | 32;
  $$0 = -1;
 }
 return $$0 | 0;
}

function __ZNSt3__26vectorIsNS_9allocatorIsEEEC2Ej($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $6 = 0, $7 = 0, $8 = 0;
 HEAP32[$0 >> 2] = 0;
 $2 = $0 + 4 | 0;
 HEAP32[$2 >> 2] = 0;
 HEAP32[$0 + 8 >> 2] = 0;
 if (!$1) return;
 if (($1 | 0) < 0) __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0);
 $6 = $1 << 1;
 $7 = __Znwj($6) | 0;
 HEAP32[$0 >> 2] = $7;
 $8 = $7 + ($1 << 1) | 0;
 HEAP32[$0 + 8 >> 2] = $8;
 _memset($7 | 0, 0, $6 | 0) | 0;
 HEAP32[$2 >> 2] = $8;
 return;
}

function __ZNSt3__26vectorIhNS_9allocatorIhEEE6resizeEjRKh($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $12 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 $3 = $0 + 4 | 0;
 $4 = HEAP32[$3 >> 2] | 0;
 $5 = HEAP32[$0 >> 2] | 0;
 $6 = $4 - $5 | 0;
 if ($6 >>> 0 < $1 >>> 0) {
  __ZNSt3__26vectorIhNS_9allocatorIhEEE8__appendEjRKh($0, $1 - $6 | 0, $2);
  return;
 }
 if ($6 >>> 0 <= $1 >>> 0) return;
 $12 = $5 + $1 | 0;
 if (($4 | 0) == ($12 | 0)) return;
 HEAP32[$3 >> 2] = $12;
 return;
}

function __ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $8 = 0;
 if (($0 | 0) == (HEAP32[$1 + 8 >> 2] | 0)) __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0, $1, $2, $3); else {
  $8 = HEAP32[$0 + 8 >> 2] | 0;
  FUNCTION_TABLE_viiii[HEAP32[(HEAP32[$8 >> 2] | 0) + 28 >> 2] & 7]($8, $1, $2, $3);
 }
 return;
}

function __GLOBAL__sub_I_haar_cpp() {
 var $0 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $0 = sp;
 __ZN38EmscriptenBindingInitializer_my_moduleC2Ev(0);
 __ZN10emscripten15register_vectorIsEENS_6class_INSt3__26vectorIT_NS2_9allocatorIS4_EEEENS_8internal11NoBaseClassEEEPKc($0, 11788);
 __ZN10emscripten15register_vectorIhEENS_6class_INSt3__26vectorIT_NS2_9allocatorIS4_EEEENS_8internal11NoBaseClassEEEPKc($0, 11800);
 STACKTOP = sp;
 return;
}

function __ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIsNS2_9allocatorIsEEEEKFjvEjPKS6_JEE6invokeERKS8_SA_($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$unpack = 0, $$unpack3 = 0, $10 = 0, $3 = 0;
 $$unpack = HEAP32[$0 >> 2] | 0;
 $$unpack3 = HEAP32[$0 + 4 >> 2] | 0;
 $3 = $1 + ($$unpack3 >> 1) | 0;
 if (!($$unpack3 & 1)) $10 = $$unpack; else $10 = HEAP32[(HEAP32[$3 >> 2] | 0) + $$unpack >> 2] | 0;
 return FUNCTION_TABLE_ii[$10 & 15]($3) | 0;
}

function __ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIhNS2_9allocatorIhEEEEKFjvEjPKS6_JEE6invokeERKS8_SA_($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$unpack = 0, $$unpack3 = 0, $10 = 0, $3 = 0;
 $$unpack = HEAP32[$0 >> 2] | 0;
 $$unpack3 = HEAP32[$0 + 4 >> 2] | 0;
 $3 = $1 + ($$unpack3 >> 1) | 0;
 if (!($$unpack3 & 1)) $10 = $$unpack; else $10 = HEAP32[(HEAP32[$3 >> 2] | 0) + $$unpack >> 2] | 0;
 return FUNCTION_TABLE_ii[$10 & 15]($3) | 0;
}

function _memmove(dest, src, num) {
 dest = dest | 0;
 src = src | 0;
 num = num | 0;
 var ret = 0;
 if ((src | 0) < (dest | 0) & (dest | 0) < (src + num | 0)) {
  ret = dest;
  src = src + num | 0;
  dest = dest + num | 0;
  while ((num | 0) > 0) {
   dest = dest - 1 | 0;
   src = src - 1 | 0;
   num = num - 1 | 0;
   HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
  }
  dest = ret;
 } else _memcpy(dest, src, num) | 0;
 return dest | 0;
}

function __ZN10emscripten8internal15FunctionInvokerIPFbRNSt3__26vectorIsNS2_9allocatorIsEEEEjRKsEbS7_JjS9_EE6invokeEPSB_PS6_js($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $4 = 0, $5 = 0, $6 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $4 = sp;
 $5 = HEAP32[$0 >> 2] | 0;
 HEAP16[$4 >> 1] = $3;
 $6 = FUNCTION_TABLE_iiii[$5 & 15]($1, $2, $4) | 0;
 STACKTOP = sp;
 return $6 | 0;
}

function __ZN10emscripten8internal15FunctionInvokerIPFbRNSt3__26vectorIhNS2_9allocatorIhEEEEjRKhEbS7_JjS9_EE6invokeEPSB_PS6_jh($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 var $4 = 0, $5 = 0, $6 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $4 = sp;
 $5 = HEAP32[$0 >> 2] | 0;
 HEAP8[$4 >> 0] = $3;
 $6 = FUNCTION_TABLE_iiii[$5 & 15]($1, $2, $4) | 0;
 STACKTOP = sp;
 return $6 | 0;
}

function __ZN10emscripten8internal14raw_destructorINSt3__26vectorIsNS2_9allocatorIsEEEEEEvPT_($0) {
 $0 = $0 | 0;
 var $2 = 0, $4 = 0, $5 = 0, $6 = 0;
 if (!$0) return;
 $2 = HEAP32[$0 >> 2] | 0;
 $4 = $2;
 if ($2 | 0) {
  $5 = $0 + 4 | 0;
  $6 = HEAP32[$5 >> 2] | 0;
  if (($6 | 0) != ($2 | 0)) HEAP32[$5 >> 2] = $6 + (~(($6 + -2 - $4 | 0) >>> 1) << 1);
  __ZdlPv($2);
 }
 __ZdlPv($0);
 return;
}

function __ZNSt3__26vectorIsNS_9allocatorIsEEE9push_backERKs($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $3 = 0;
 $2 = $0 + 4 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 if (($3 | 0) == (HEAP32[$0 + 8 >> 2] | 0)) {
  __ZNSt3__26vectorIsNS_9allocatorIsEEE21__push_back_slow_pathIRKsEEvOT_($0, $1);
  return;
 } else {
  HEAP16[$3 >> 1] = HEAP16[$1 >> 1] | 0;
  HEAP32[$2 >> 2] = $3 + 2;
  return;
 }
}

function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
 $a$0 = $a$0 | 0;
 $a$1 = $a$1 | 0;
 $b$0 = $b$0 | 0;
 $b$1 = $b$1 | 0;
 var $rem = 0, __stackBase__ = 0;
 __stackBase__ = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $rem = __stackBase__ | 0;
 ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0;
 STACKTOP = __stackBase__;
 return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0;
}

function __ZSt9terminatev() {
 var $0 = 0, $2 = 0, $5 = 0;
 $0 = ___cxa_get_globals_fast() | 0;
 if ($0 | 0) {
  $2 = HEAP32[$0 >> 2] | 0;
  if ($2 | 0) {
   $5 = $2 + 48 | 0;
   if ((HEAP32[$5 >> 2] & -256 | 0) == 1126902528 ? (HEAP32[$5 + 4 >> 2] | 0) == 1129074247 : 0) __ZSt11__terminatePFvvE(HEAP32[$2 + 12 >> 2] | 0);
  }
 }
 __ZSt11__terminatePFvvE(__ZSt13get_terminatev() | 0);
}

function __ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0, $1, $2, $3, $4, $5) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 $4 = $4 | 0;
 $5 = $5 | 0;
 if (($0 | 0) == (HEAP32[$1 + 8 >> 2] | 0)) __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0, $1, $2, $3, $4);
 return;
}

function ___cxa_can_catch($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $3 = 0, $8 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $3 = sp;
 HEAP32[$3 >> 2] = HEAP32[$2 >> 2];
 $8 = FUNCTION_TABLE_iiii[HEAP32[(HEAP32[$0 >> 2] | 0) + 16 >> 2] & 15]($0, $1, $3) | 0;
 if ($8) HEAP32[$2 >> 2] = HEAP32[$3 >> 2];
 STACKTOP = sp;
 return $8 & 1 | 0;
}

function _llvm_cttz_i32(x) {
 x = x | 0;
 var ret = 0;
 ret = HEAP8[cttz_i8 + (x & 255) >> 0] | 0;
 if ((ret | 0) < 8) return ret | 0;
 ret = HEAP8[cttz_i8 + (x >> 8 & 255) >> 0] | 0;
 if ((ret | 0) < 8) return ret + 8 | 0;
 ret = HEAP8[cttz_i8 + (x >> 16 & 255) >> 0] | 0;
 if ((ret | 0) < 8) return ret + 16 | 0;
 return (HEAP8[cttz_i8 + (x >>> 24) >> 0] | 0) + 24 | 0;
}

function __Z8compressRNSt3__26vectorIsNS_9allocatorIsEEEE($0) {
 $0 = $0 | 0;
 var $1 = 0, $2 = 0, $4 = 0;
 $1 = __Z6encodeRNSt3__26vectorIsNS_9allocatorIsEEEE($0) | 0;
 $2 = __Z11compressVecRNSt3__26vectorIbNS_9allocatorIbEEEE($1) | 0;
 if (!$1) return $2 | 0;
 $4 = HEAP32[$1 >> 2] | 0;
 if ($4 | 0) __ZdlPv($4);
 __ZdlPv($1);
 return $2 | 0;
}

function __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 if (($0 | 0) == (HEAP32[$1 + 8 >> 2] | 0)) __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0, $1, $2, $3);
 return;
}

function __ZNSt3__218__libcpp_refstringC2EPKc($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $4 = 0, $7 = 0;
 $2 = _strlen($1) | 0;
 $4 = __Znwj($2 + 13 | 0) | 0;
 HEAP32[$4 >> 2] = $2;
 HEAP32[$4 + 4 >> 2] = $2;
 HEAP32[$4 + 8 >> 2] = 0;
 $7 = $4 + 12 | 0;
 _memcpy($7 | 0, $1 | 0, $2 + 1 | 0) | 0;
 HEAP32[$0 >> 2] = $7;
 return;
}

function __tr_init($0) {
 $0 = $0 | 0;
 HEAP32[$0 + 2840 >> 2] = $0 + 148;
 HEAP32[$0 + 2848 >> 2] = 952;
 HEAP32[$0 + 2852 >> 2] = $0 + 2440;
 HEAP32[$0 + 2860 >> 2] = 972;
 HEAP32[$0 + 2864 >> 2] = $0 + 2684;
 HEAP32[$0 + 2872 >> 2] = 992;
 HEAP16[$0 + 5816 >> 1] = 0;
 HEAP32[$0 + 5820 >> 2] = 0;
 _init_block($0);
 return;
}

function __Znwj($0) {
 $0 = $0 | 0;
 var $$ = 0, $$lcssa = 0, $2 = 0, $4 = 0;
 $$ = ($0 | 0) == 0 ? 1 : $0;
 while (1) {
  $2 = _malloc($$) | 0;
  if ($2 | 0) {
   $$lcssa = $2;
   break;
  }
  $4 = __ZSt15get_new_handlerv() | 0;
  if (!$4) {
   $$lcssa = 0;
   break;
  }
  FUNCTION_TABLE_v[$4 & 3]();
 }
 return $$lcssa | 0;
}

function ___stdio_close($0) {
 $0 = $0 | 0;
 var $5 = 0, $vararg_buffer = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $vararg_buffer = sp;
 HEAP32[$vararg_buffer >> 2] = _dummy_515(HEAP32[$0 + 60 >> 2] | 0) | 0;
 $5 = ___syscall_ret(___syscall6(6, $vararg_buffer | 0) | 0) | 0;
 STACKTOP = sp;
 return $5 | 0;
}

function __ZN10emscripten8internal15FunctionInvokerIPFNS_3valERKNSt3__26vectorIsNS3_9allocatorIsEEEEjES2_S9_JjEE6invokeEPSB_PS7_j($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $4 = 0;
 $4 = FUNCTION_TABLE_iii[HEAP32[$0 >> 2] & 15]($1, $2) | 0;
 __emval_incref($4 | 0);
 __emval_decref($4 | 0);
 return $4 | 0;
}

function __ZN10emscripten8internal15FunctionInvokerIPFNS_3valERKNSt3__26vectorIhNS3_9allocatorIhEEEEjES2_S9_JjEE6invokeEPSB_PS7_j($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 var $4 = 0;
 $4 = FUNCTION_TABLE_iii[HEAP32[$0 >> 2] & 15]($1, $2) | 0;
 __emval_incref($4 | 0);
 __emval_decref($4 | 0);
 return $4 | 0;
}

function __ZN10emscripten8internal14raw_destructorINSt3__26vectorIhNS2_9allocatorIhEEEEEEvPT_($0) {
 $0 = $0 | 0;
 var $2 = 0, $4 = 0;
 if (!$0) return;
 $2 = HEAP32[$0 >> 2] | 0;
 if ($2 | 0) {
  $4 = $0 + 4 | 0;
  if ((HEAP32[$4 >> 2] | 0) != ($2 | 0)) HEAP32[$4 >> 2] = $2;
  __ZdlPv($2);
 }
 __ZdlPv($0);
 return;
}

function __ZN10emscripten8internal7InvokerINSt3__210unique_ptrINS2_6vectorIsNS2_9allocatorIsEEEENS2_14default_deleteIS7_EEEEJjjRNS4_IhNS5_IhEEEEEE6invokeEPFSA_jjSD_EjjPSC_($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 return FUNCTION_TABLE_iiii[$0 & 15]($1, $2, $3) | 0;
}

function _abort_message($0, $varargs) {
 $0 = $0 | 0;
 $varargs = $varargs | 0;
 var $1 = 0, $2 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $1 = sp;
 HEAP32[$1 >> 2] = $varargs;
 $2 = HEAP32[2448] | 0;
 _vfprintf($2, $0, $1) | 0;
 _fputc(10, $2) | 0;
 _abort();
}

function ___cxa_get_globals_fast() {
 var $3 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 if (!(_pthread_once(18580, 2) | 0)) {
  $3 = _pthread_getspecific(HEAP32[4646] | 0) | 0;
  STACKTOP = sp;
  return $3 | 0;
 } else _abort_message(17593, sp);
 return 0;
}

function _bitshift64Shl(low, high, bits) {
 low = low | 0;
 high = high | 0;
 bits = bits | 0;
 if ((bits | 0) < 32) {
  tempRet0 = high << bits | (low & (1 << bits) - 1 << 32 - bits) >>> 32 - bits;
  return low << bits;
 }
 tempRet0 = low << bits - 32;
 return 0;
}

function __ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv($0) {
 $0 = $0 | 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 _free($0);
 if (!(_pthread_setspecific(HEAP32[4646] | 0, 0) | 0)) {
  STACKTOP = sp;
  return;
 } else _abort_message(17692, sp);
}

function _bitshift64Lshr(low, high, bits) {
 low = low | 0;
 high = high | 0;
 bits = bits | 0;
 if ((bits | 0) < 32) {
  tempRet0 = high >>> bits;
  return low >>> bits | (high & (1 << bits) - 1) << 32 - bits;
 }
 tempRet0 = 0;
 return high >>> bits - 32 | 0;
}

function __ZN12_GLOBAL__N_114__libcpp_nmstrD2Ev($0) {
 $0 = $0 | 0;
 var $2 = 0, $3 = 0;
 $2 = (HEAP32[$0 >> 2] | 0) + -4 | 0;
 $3 = HEAP32[$2 >> 2] | 0;
 HEAP32[$2 >> 2] = $3 + -1;
 if (($3 + -1 | 0) < 0) __ZdlPv((HEAP32[$0 >> 2] | 0) + -12 | 0);
 return;
}

function __ZN10emscripten8internal7InvokerINSt3__210unique_ptrINS2_6vectorIhNS2_9allocatorIhEEEENS2_14default_deleteIS7_EEEEJRNS4_IsNS5_IsEEEEEE6invokeEPFSA_SD_EPSC_($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 return FUNCTION_TABLE_ii[$0 & 15]($1) | 0;
}

function dynCall_viiiiii(index, a1, a2, a3, a4, a5, a6) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 a5 = a5 | 0;
 a6 = a6 | 0;
 FUNCTION_TABLE_viiiiii[index & 3](a1 | 0, a2 | 0, a3 | 0, a4 | 0, a5 | 0, a6 | 0);
}

function __ZN10emscripten8internal12VectorAccessINSt3__26vectorIsNS2_9allocatorIsEEEEE3setERS6_jRKs($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 HEAP16[(HEAP32[$0 >> 2] | 0) + ($1 << 1) >> 1] = HEAP16[$2 >> 1] | 0;
 return 1;
}

function runPostSets() {}
function _i64Subtract(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 var h = 0;
 h = b - d >>> 0;
 h = b - d - (c >>> 0 > a >>> 0 | 0) >>> 0;
 return (tempRet0 = h, a - c >>> 0 | 0) | 0;
}

function __ZN10emscripten8internal12VectorAccessINSt3__26vectorIhNS2_9allocatorIhEEEEE3setERS6_jRKh($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 HEAP8[(HEAP32[$0 >> 2] | 0) + $1 >> 0] = HEAP8[$2 >> 0] | 0;
 return 1;
}

function __ZN10emscripten8internal12operator_newINSt3__26vectorIsNS2_9allocatorIsEEEEJEEEPT_DpOT0_() {
 var $0 = 0;
 $0 = __Znwj(12) | 0;
 HEAP32[$0 >> 2] = 0;
 HEAP32[$0 + 4 >> 2] = 0;
 HEAP32[$0 + 8 >> 2] = 0;
 return $0 | 0;
}

function __ZN10emscripten8internal12operator_newINSt3__26vectorIhNS2_9allocatorIhEEEEJEEEPT_DpOT0_() {
 var $0 = 0;
 $0 = __Znwj(12) | 0;
 HEAP32[$0 >> 2] = 0;
 HEAP32[$0 + 4 >> 2] = 0;
 HEAP32[$0 + 8 >> 2] = 0;
 return $0 | 0;
}

function __ZN10__cxxabiv112_GLOBAL__N_110construct_Ev() {
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 if (!(_pthread_key_create(18584, 15) | 0)) {
  STACKTOP = sp;
  return;
 } else _abort_message(17642, sp);
}

function ___strdup($0) {
 $0 = $0 | 0;
 var $$0 = 0, $2 = 0, $3 = 0;
 $2 = (_strlen($0) | 0) + 1 | 0;
 $3 = _malloc($2) | 0;
 if (!$3) $$0 = 0; else {
  _memcpy($3 | 0, $0 | 0, $2 | 0) | 0;
  $$0 = $3;
 }
 return $$0 | 0;
}

function dynCall_viiiii(index, a1, a2, a3, a4, a5) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 a5 = a5 | 0;
 FUNCTION_TABLE_viiiii[index & 3](a1 | 0, a2 | 0, a3 | 0, a4 | 0, a5 | 0);
}

function __ZN10emscripten8internal7InvokerIlJRNSt3__26vectorIsNS2_9allocatorIsEEEEiEE6invokeEPFlS7_iEPS6_i($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 return FUNCTION_TABLE_iii[$0 & 15]($1, $2) | 0;
}

function __ZN10emscripten8internal7InvokerIbJRNSt3__26vectorIsNS2_9allocatorIsEEEEiEE6invokeEPFbS7_iEPS6_i($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 return FUNCTION_TABLE_iii[$0 & 15]($1, $2) | 0;
}

function ___lctrans_impl($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0 = 0;
 if (!$1) $$0 = 0; else $$0 = ___mo_lookup(HEAP32[$1 >> 2] | 0, HEAP32[$1 + 4 >> 2] | 0, $0) | 0;
 return ($$0 | 0 ? $$0 : $0) | 0;
}

function dynCall_iiiii(index, a1, a2, a3, a4) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 return FUNCTION_TABLE_iiiii[index & 3](a1 | 0, a2 | 0, a3 | 0, a4 | 0) | 0;
}

function dynCall_viiii(index, a1, a2, a3, a4) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 a4 = a4 | 0;
 FUNCTION_TABLE_viiii[index & 7](a1 | 0, a2 | 0, a3 | 0, a4 | 0);
}

function ___syscall_ret($0) {
 $0 = $0 | 0;
 var $$0 = 0;
 if ($0 >>> 0 > 4294963200) {
  HEAP32[(___errno_location() | 0) >> 2] = 0 - $0;
  $$0 = -1;
 } else $$0 = $0;
 return $$0 | 0;
}

function __ZN10emscripten8internal7InvokerIbJRNSt3__26vectorIsNS2_9allocatorIsEEEEEE6invokeEPFbS7_EPS6_($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 return FUNCTION_TABLE_ii[$0 & 15]($1) | 0;
}

function _i64Add(a, b, c, d) {
 a = a | 0;
 b = b | 0;
 c = c | 0;
 d = d | 0;
 var l = 0;
 l = a + c >>> 0;
 return (tempRet0 = b + d + (l >>> 0 < a >>> 0 | 0) >>> 0, l | 0) | 0;
}

function __ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 return ($0 | 0) == ($1 | 0) | 0;
}

function dynCall_iiii(index, a1, a2, a3) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 return FUNCTION_TABLE_iiii[index & 15](a1 | 0, a2 | 0, a3 | 0) | 0;
}

function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
 $a$0 = $a$0 | 0;
 $a$1 = $a$1 | 0;
 $b$0 = $b$0 | 0;
 $b$1 = $b$1 | 0;
 return ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
}

function __ZSt11__terminatePFvvE($0) {
 $0 = $0 | 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 FUNCTION_TABLE_v[$0 & 3]();
 _abort_message(17745, sp);
}

function __ZNSt13runtime_errorC2EPKc($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 HEAP32[$0 >> 2] = 10408;
 __ZNSt3__218__libcpp_refstringC2EPKc($0 + 4 | 0, $1);
 return;
}

function dynCall_viii(index, a1, a2, a3) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 a3 = a3 | 0;
 FUNCTION_TABLE_viii[index & 7](a1 | 0, a2 | 0, a3 | 0);
}
function stackAlloc(size) {
 size = size | 0;
 var ret = 0;
 ret = STACKTOP;
 STACKTOP = STACKTOP + size | 0;
 STACKTOP = STACKTOP + 15 & -16;
 return ret | 0;
}

function __ZN10emscripten8internal7InvokerIPNSt3__26vectorIsNS2_9allocatorIsEEEEJEE6invokeEPFS7_vE($0) {
 $0 = $0 | 0;
 return FUNCTION_TABLE_i[$0 & 3]() | 0;
}

function __ZN10emscripten8internal7InvokerIPNSt3__26vectorIhNS2_9allocatorIhEEEEJEE6invokeEPFS7_vE($0) {
 $0 = $0 | 0;
 return FUNCTION_TABLE_i[$0 & 3]() | 0;
}

function ___cxa_is_pointer_type($0) {
 $0 = $0 | 0;
 var $4 = 0;
 if (!$0) $4 = 0; else $4 = (___dynamic_cast($0, 384, 472, 0) | 0) != 0;
 return $4 & 1 | 0;
}

function _deflateInit_($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 return _deflateInit2_($0, $1, 8, 15, 8, 0, $2, $3) | 0;
}

function establishStackSpace(stackBase, stackMax) {
 stackBase = stackBase | 0;
 stackMax = stackMax | 0;
 STACKTOP = stackBase;
 STACK_MAX = stackMax;
}

function dynCall_iii(index, a1, a2) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 return FUNCTION_TABLE_iii[index & 15](a1 | 0, a2 | 0) | 0;
}

function __ZNSt13runtime_errorD2Ev($0) {
 $0 = $0 | 0;
 HEAP32[$0 >> 2] = 10408;
 __ZN12_GLOBAL__N_114__libcpp_nmstrD2Ev($0 + 4 | 0);
 return;
}

function __ZNKSt3__26vectorIsNS_9allocatorIsEEE4sizeEv($0) {
 $0 = $0 | 0;
 return (HEAP32[$0 + 4 >> 2] | 0) - (HEAP32[$0 >> 2] | 0) >> 1 | 0;
}

function _wctomb($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $$0 = 0;
 if (!$0) $$0 = 0; else $$0 = _wcrtomb($0, $1, 0) | 0;
 return $$0 | 0;
}

function setThrew(threw, value) {
 threw = threw | 0;
 value = value | 0;
 if (!__THREW__) {
  __THREW__ = threw;
  threwValue = value;
 }
}

function __ZNKSt3__26vectorIhNS_9allocatorIhEEE4sizeEv($0) {
 $0 = $0 | 0;
 return (HEAP32[$0 + 4 >> 2] | 0) - (HEAP32[$0 >> 2] | 0) | 0;
}

function __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0) {
 $0 = $0 | 0;
 ___assert_fail(17225, 17248, 304, 17297);
}

function dynCall_vii(index, a1, a2) {
 index = index | 0;
 a1 = a1 | 0;
 a2 = a2 | 0;
 FUNCTION_TABLE_vii[index & 3](a1 | 0, a2 | 0);
}

function b9(p0, p1, p2, p3, p4, p5) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 p4 = p4 | 0;
 p5 = p5 | 0;
 abort(9);
}

function _llvm_bswap_i32(x) {
 x = x | 0;
 return (x & 255) << 24 | (x >> 8 & 255) << 16 | (x >> 16 & 255) << 8 | x >>> 24 | 0;
}

function __ZN10emscripten8internal13getActualTypeINSt3__26vectorIsNS2_9allocatorIsEEEEEEPKvPT_($0) {
 $0 = $0 | 0;
 return 104;
}

function __ZN10emscripten8internal13getActualTypeINSt3__26vectorIhNS2_9allocatorIhEEEEEEPKvPT_($0) {
 $0 = $0 | 0;
 return 8;
}

function dynCall_ii(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 return FUNCTION_TABLE_ii[index & 15](a1 | 0) | 0;
}

function _zcalloc($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 return _malloc(Math_imul($2, $1) | 0) | 0;
}

function _strerror($0) {
 $0 = $0 | 0;
 return ___strerror_l($0, HEAP32[(_pthread_self() | 0) + 188 >> 2] | 0) | 0;
}

function __GLOBAL__sub_I_bind_cpp() {
 __ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev(0);
 return;
}

function b1(p0, p1, p2, p3, p4) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 p4 = p4 | 0;
 abort(1);
}

function __ZSt15get_new_handlerv() {
 var $0 = 0;
 $0 = HEAP32[4647] | 0;
 HEAP32[4647] = $0 + 0;
 return $0 | 0;
}

function __ZSt13get_terminatev() {
 var $0 = 0;
 $0 = HEAP32[2573] | 0;
 HEAP32[2573] = $0 + 0;
 return $0 | 0;
}

function _adler32($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 return _adler32_z($0, $1, $2) | 0;
}

function __ZNSt13runtime_errorD0Ev($0) {
 $0 = $0 | 0;
 __ZNSt13runtime_errorD2Ev($0);
 __ZdlPv($0);
 return;
}

function b8(p0, p1, p2, p3) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 abort(8);
 return 0;
}

function dynCall_vi(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 FUNCTION_TABLE_vi[index & 15](a1 | 0);
}

function _compressBound($0) {
 $0 = $0 | 0;
 return $0 + 13 + ($0 >>> 12) + ($0 >>> 14) + ($0 >>> 25) | 0;
}

function ___clang_call_terminate($0) {
 $0 = $0 | 0;
 ___cxa_begin_catch($0 | 0) | 0;
 __ZSt9terminatev();
}

function _crc32($0, $1, $2) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 return _crc32_z($0, $1, $2) | 0;
}

function b11(p0, p1, p2, p3) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 p3 = p3 | 0;
 abort(11);
}

function __ZN10__cxxabiv123__fundamental_type_infoD0Ev($0) {
 $0 = $0 | 0;
 __ZdlPv($0);
 return;
}

function __ZN10__cxxabiv121__vmi_class_type_infoD0Ev($0) {
 $0 = $0 | 0;
 __ZdlPv($0);
 return;
}

function ___lctrans($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 return ___lctrans_impl($0, $1) | 0;
}

function __ZN10__cxxabiv120__si_class_type_infoD0Ev($0) {
 $0 = $0 | 0;
 __ZdlPv($0);
 return;
}

function __ZN10__cxxabiv119__pointer_type_infoD0Ev($0) {
 $0 = $0 | 0;
 __ZdlPv($0);
 return;
}

function ___getTypeName($0) {
 $0 = $0 | 0;
 return ___strdup(HEAP32[$0 + 4 >> 2] | 0) | 0;
}

function __ZNKSt13runtime_error4whatEv($0) {
 $0 = $0 | 0;
 return HEAP32[$0 + 4 >> 2] | 0;
}

function __ZN10__cxxabiv117__class_type_infoD0Ev($0) {
 $0 = $0 | 0;
 __ZdlPv($0);
 return;
}

function dynCall_i(index) {
 index = index | 0;
 return FUNCTION_TABLE_i[index & 3]() | 0;
}

function b0(p0, p1, p2) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 abort(0);
 return 0;
}

function __ZNSt9bad_allocC2Ev($0) {
 $0 = $0 | 0;
 HEAP32[$0 >> 2] = 10388;
 return;
}

function __ZNK10__cxxabiv116__shim_type_info5noop2Ev($0) {
 $0 = $0 | 0;
 return;
}

function __ZNK10__cxxabiv116__shim_type_info5noop1Ev($0) {
 $0 = $0 | 0;
 return;
}

function dynCall_v(index) {
 index = index | 0;
 FUNCTION_TABLE_v[index & 3]();
}

function _frexpl($0, $1) {
 $0 = +$0;
 $1 = $1 | 0;
 return +(+_frexp($0, $1));
}

function b6(p0, p1, p2) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 p2 = p2 | 0;
 abort(6);
}

function __ZN10__cxxabiv116__shim_type_infoD2Ev($0) {
 $0 = $0 | 0;
 return;
}

function _zcfree($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 _free($1);
 return;
}

function b10(p0, p1) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 abort(10);
 return 0;
}

function __ZNSt9bad_allocD0Ev($0) {
 $0 = $0 | 0;
 __ZdlPv($0);
 return;
}

function ___errno_location() {
 return (_pthread_self() | 0) + 64 | 0;
}

function setTempRet0(value) {
 value = value | 0;
 tempRet0 = value;
}

function __ZNKSt9bad_alloc4whatEv($0) {
 $0 = $0 | 0;
 return 17785;
}

function stackRestore(top) {
 top = top | 0;
 STACKTOP = top;
}

function b4(p0, p1) {
 p0 = p0 | 0;
 p1 = p1 | 0;
 abort(4);
}

function __ZNSt9type_infoD2Ev($0) {
 $0 = $0 | 0;
 return;
}

function __ZNSt9exceptionD2Ev($0) {
 $0 = $0 | 0;
 return;
}

function __ZNSt9bad_allocD2Ev($0) {
 $0 = $0 | 0;
 return;
}

function __ZdlPv($0) {
 $0 = $0 | 0;
 _free($0);
 return;
}

function ___ofl_lock() {
 ___lock(18072);
 return 18080;
}

function _emscripten_get_global_libc() {
 return 18008;
}

function _dummy_515($0) {
 $0 = $0 | 0;
 return $0 | 0;
}

function ___ofl_unlock() {
 ___unlock(18072);
 return;
}

function b5(p0) {
 p0 = p0 | 0;
 abort(5);
 return 0;
}

function ___unlockfile($0) {
 $0 = $0 | 0;
 return;
}

function ___lockfile($0) {
 $0 = $0 | 0;
 return 0;
}

function getTempRet0() {
 return tempRet0 | 0;
}

function stackSave() {
 return STACKTOP | 0;
}

function b3(p0) {
 p0 = p0 | 0;
 abort(3);
}

function _pthread_self() {
 return 9920;
}

function b2() {
 abort(2);
 return 0;
}

function b7() {
 abort(7);
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_iiii = [b0,___stdio_write,___stdio_seek,___stdout_write,__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv,__ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv,__ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv,__Z11encodeImagejjRNSt3__26vectorIhNS_9allocatorIhEEEE,__ZN10emscripten8internal7InvokerIbJRNSt3__26vectorIsNS2_9allocatorIsEEEEiEE6invokeEPFbS7_iEPS6_i,__ZN10emscripten8internal7InvokerIlJRNSt3__26vectorIsNS2_9allocatorIsEEEEiEE6invokeEPFlS7_iEPS6_i,__ZN10emscripten8internal15FunctionInvokerIPFNS_3valERKNSt3__26vectorIsNS3_9allocatorIsEEEEjES2_S9_JjEE6invokeEPSB_PS7_j,__ZN10emscripten8internal12VectorAccessINSt3__26vectorIsNS2_9allocatorIsEEEEE3setERS6_jRKs,__ZN10emscripten8internal15FunctionInvokerIPFNS_3valERKNSt3__26vectorIhNS3_9allocatorIhEEEEjES2_S9_JjEE6invokeEPSB_PS7_j,__ZN10emscripten8internal12VectorAccessINSt3__26vectorIhNS2_9allocatorIhEEEEE3setERS6_jRKh,_zcalloc,b0];
var FUNCTION_TABLE_viiiii = [b1,__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib];
var FUNCTION_TABLE_i = [b2,__ZN10emscripten8internal12operator_newINSt3__26vectorIsNS2_9allocatorIsEEEEJEEEPT_DpOT0_,__ZN10emscripten8internal12operator_newINSt3__26vectorIhNS2_9allocatorIhEEEEJEEEPT_DpOT0_,b2];
var FUNCTION_TABLE_vi = [b3,__ZN10__cxxabiv116__shim_type_infoD2Ev,__ZN10__cxxabiv117__class_type_infoD0Ev,__ZNK10__cxxabiv116__shim_type_info5noop1Ev,__ZNK10__cxxabiv116__shim_type_info5noop2Ev,__ZN10__cxxabiv120__si_class_type_infoD0Ev,__ZNSt9bad_allocD2Ev,__ZNSt9bad_allocD0Ev,__ZNSt13runtime_errorD2Ev,__ZNSt13runtime_errorD0Ev,__ZN10__cxxabiv123__fundamental_type_infoD0Ev,__ZN10__cxxabiv119__pointer_type_infoD0Ev,__ZN10__cxxabiv121__vmi_class_type_infoD0Ev,__ZN10emscripten8internal14raw_destructorINSt3__26vectorIsNS2_9allocatorIsEEEEEEvPT_,__ZN10emscripten8internal14raw_destructorINSt3__26vectorIhNS2_9allocatorIhEEEEEEvPT_,__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv];
var FUNCTION_TABLE_vii = [b4,__ZNSt3__26vectorIsNS_9allocatorIsEEE9push_backERKs,__ZNSt3__26vectorIhNS_9allocatorIhEEE9push_backERKh,_zcfree];
var FUNCTION_TABLE_ii = [b5,___stdio_close,__ZNKSt9bad_alloc4whatEv,__ZNKSt13runtime_error4whatEv,__Z8compressRNSt3__26vectorIsNS_9allocatorIsEEEE,__Z12decodeImageWNSt3__210unique_ptrINS_6vectorIsNS_9allocatorIsEEEENS_14default_deleteIS4_EEEE,__Z13haarTransformRNSt3__26vectorIsNS_9allocatorIsEEEE,__Z14ihaarTransformRNSt3__26vectorIsNS_9allocatorIsEEEE,__ZN10emscripten8internal13getActualTypeINSt3__26vectorIsNS2_9allocatorIsEEEEEEPKvPT_,__ZN10emscripten8internal7InvokerIPNSt3__26vectorIsNS2_9allocatorIsEEEEJEE6invokeEPFS7_vE,__ZNKSt3__26vectorIsNS_9allocatorIsEEE4sizeEv,__ZN10emscripten8internal13getActualTypeINSt3__26vectorIhNS2_9allocatorIhEEEEEEPKvPT_,__ZN10emscripten8internal7InvokerIPNSt3__26vectorIhNS2_9allocatorIhEEEEJEE6invokeEPFS7_vE,__ZNKSt3__26vectorIhNS_9allocatorIhEEE4sizeEv,b5,b5];
var FUNCTION_TABLE_viii = [b6,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIsNS2_9allocatorIsEEEEFvRKsEvPS6_JS8_EE6invokeERKSA_SB_s,__ZNSt3__26vectorIsNS_9allocatorIsEEE6resizeEjRKs,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIhNS2_9allocatorIhEEEEFvRKhEvPS6_JS8_EE6invokeERKSA_SB_h,__ZNSt3__26vectorIhNS_9allocatorIhEEE6resizeEjRKh,b6,b6,b6];
var FUNCTION_TABLE_v = [b7,__ZL25default_terminate_handlerv,__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev,b7];
var FUNCTION_TABLE_iiiii = [b8,__ZN10emscripten8internal7InvokerINSt3__210unique_ptrINS2_6vectorIsNS2_9allocatorIsEEEENS2_14default_deleteIS7_EEEEJjjRNS4_IhNS5_IhEEEEEE6invokeEPFSA_jjSD_EjjPSC_,__ZN10emscripten8internal15FunctionInvokerIPFbRNSt3__26vectorIsNS2_9allocatorIsEEEEjRKsEbS7_JjS9_EE6invokeEPSB_PS6_js,__ZN10emscripten8internal15FunctionInvokerIPFbRNSt3__26vectorIhNS2_9allocatorIhEEEEjRKhEbS7_JjS9_EE6invokeEPSB_PS6_jh];
var FUNCTION_TABLE_viiiiii = [b9,__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib];
var FUNCTION_TABLE_iii = [b10,_deflate_stored,_deflate_fast,_deflate_slow,__ZN10emscripten8internal7InvokerINSt3__210unique_ptrINS2_6vectorIhNS2_9allocatorIhEEEENS2_14default_deleteIS7_EEEEJRNS4_IsNS5_IsEEEEEE6invokeEPFSA_SD_EPSC_,__ZN10emscripten8internal7InvokerINSt3__210unique_ptrINS2_6vectorIhNS2_9allocatorIhEEEENS2_14default_deleteIS7_EEEEJNS3_INS4_IsNS5_IsEEEENS8_ISC_EEEEEE6invokeEPFSA_SE_EPSC_,__ZN10emscripten8internal7InvokerIbJRNSt3__26vectorIsNS2_9allocatorIsEEEEEE6invokeEPFbS7_EPS6_,__Z19haarTransform2DFlatRNSt3__26vectorIsNS_9allocatorIsEEEEi,__Z20ihaarTransform2DFlatRNSt3__26vectorIsNS_9allocatorIsEEEEi,__Z9thresholdRNSt3__26vectorIsNS_9allocatorIsEEEEi,__Z10threshold2RNSt3__26vectorIsNS_9allocatorIsEEEEi,__Z10threshold3RNSt3__26vectorIsNS_9allocatorIsEEEEi,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIsNS2_9allocatorIsEEEEKFjvEjPKS6_JEE6invokeERKS8_SA_,__ZN10emscripten8internal12VectorAccessINSt3__26vectorIsNS2_9allocatorIsEEEEE3getERKS6_j,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIhNS2_9allocatorIhEEEEKFjvEjPKS6_JEE6invokeERKS8_SA_,__ZN10emscripten8internal12VectorAccessINSt3__26vectorIhNS2_9allocatorIhEEEEE3getERKS6_j];
var FUNCTION_TABLE_viiii = [b11,__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIsNS2_9allocatorIsEEEEFvjRKsEvPS6_JjS8_EE6invokeERKSA_SB_js,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIhNS2_9allocatorIhEEEEFvjRKhEvPS6_JjS8_EE6invokeERKSA_SB_jh,b11,b11];

  return { _llvm_cttz_i32: _llvm_cttz_i32, ___cxa_can_catch: ___cxa_can_catch, _fflush: _fflush, ___udivmoddi4: ___udivmoddi4, ___cxa_is_pointer_type: ___cxa_is_pointer_type, _i64Add: _i64Add, _memmove: _memmove, _i64Subtract: _i64Subtract, _memset: _memset, _malloc: _malloc, _emscripten_get_global_libc: _emscripten_get_global_libc, _memcpy: _memcpy, ___getTypeName: ___getTypeName, _llvm_bswap_i32: _llvm_bswap_i32, _sbrk: _sbrk, _bitshift64Lshr: _bitshift64Lshr, _free: _free, ___udivdi3: ___udivdi3, ___uremdi3: ___uremdi3, ___errno_location: ___errno_location, _bitshift64Shl: _bitshift64Shl, __GLOBAL__sub_I_haar_cpp: __GLOBAL__sub_I_haar_cpp, __GLOBAL__sub_I_bind_cpp: __GLOBAL__sub_I_bind_cpp, runPostSets: runPostSets, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setTempRet0: setTempRet0, getTempRet0: getTempRet0, setThrew: setThrew, stackAlloc: stackAlloc, stackSave: stackSave, stackRestore: stackRestore, establishStackSpace: establishStackSpace, setThrew: setThrew, setTempRet0: setTempRet0, getTempRet0: getTempRet0, dynCall_iiii: dynCall_iiii, dynCall_viiiii: dynCall_viiiii, dynCall_i: dynCall_i, dynCall_vi: dynCall_vi, dynCall_vii: dynCall_vii, dynCall_ii: dynCall_ii, dynCall_viii: dynCall_viii, dynCall_v: dynCall_v, dynCall_iiiii: dynCall_iiiii, dynCall_viiiiii: dynCall_viiiiii, dynCall_iii: dynCall_iii, dynCall_viiii: dynCall_viiii };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var stackSave = Module["stackSave"] = asm["stackSave"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var _memset = Module["_memset"] = asm["_memset"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = asm["___cxa_is_pointer_type"];
var _llvm_cttz_i32 = Module["_llvm_cttz_i32"] = asm["_llvm_cttz_i32"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"];
var ___uremdi3 = Module["___uremdi3"] = asm["___uremdi3"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var __GLOBAL__sub_I_bind_cpp = Module["__GLOBAL__sub_I_bind_cpp"] = asm["__GLOBAL__sub_I_bind_cpp"];
var ___udivmoddi4 = Module["___udivmoddi4"] = asm["___udivmoddi4"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _emscripten_get_global_libc = Module["_emscripten_get_global_libc"] = asm["_emscripten_get_global_libc"];
var ___getTypeName = Module["___getTypeName"] = asm["___getTypeName"];
var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___cxa_can_catch = Module["___cxa_can_catch"] = asm["___cxa_can_catch"];
var _free = Module["_free"] = asm["_free"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var _memmove = Module["_memmove"] = asm["_memmove"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var __GLOBAL__sub_I_haar_cpp = Module["__GLOBAL__sub_I_haar_cpp"] = asm["__GLOBAL__sub_I_haar_cpp"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
;

Runtime.stackAlloc = Module['stackAlloc'];
Runtime.stackSave = Module['stackSave'];
Runtime.stackRestore = Module['stackRestore'];
Runtime.establishStackSpace = Module['establishStackSpace'];

Runtime.setTempRet0 = Module['setTempRet0'];
Runtime.getTempRet0 = Module['getTempRet0'];



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;





function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      if (e && typeof e === 'object' && e.stack) Module.printErr('exception thrown: ' + [e, e.stack]);
      throw e;
    }
  } finally {
    calledMain = true;
  }
}




function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    return;
  }


  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();


    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    return;
  }

  if (Module['noExitRuntime']) {
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  } else if (ENVIRONMENT_IS_SHELL && typeof quit === 'function') {
    quit(status);
  }
  // if we reach here, we must throw an exception to halt the current execution
  throw new ExitStatus(status);
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}






