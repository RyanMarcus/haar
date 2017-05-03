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

STATICTOP = STATIC_BASE + 8288;
  /* global initializers */  __ATINIT__.push({ func: function() { __GLOBAL__sub_I_haar_cpp() } }, { func: function() { __GLOBAL__sub_I_bind_cpp() } });
  

/* memory initializer */ allocate([44,5,0,0,176,6,0,0,200,5,0,0,132,6,0,0,0,0,0,0,1,0,0,0,8,0,0,0,0,0,0,0,200,5,0,0,96,6,0,0,0,0,0,0,1,0,0,0,16,0,0,0,0,0,0,0,200,5,0,0,249,6,0,0,0,0,0,0,1,0,0,0,8,0,0,0,0,0,0,0,200,5,0,0,213,6,0,0,0,0,0,0,1,0,0,0,64,0,0,0,0,0,0,0,172,5,0,0,82,7,0,0,0,0,0,0,40,0,0,0,172,5,0,0,119,7,0,0,1,0,0,0,40,0,0,0,44,5,0,0,176,7,0,0,172,5,0,0,195,7,0,0,0,0,0,0,88,0,0,0,172,5,0,0,232,7,0,0,1,0,0,0,88,0,0,0,200,5,0,0,67,13,0,0,0,0,0,0,1,0,0,0,96,1,0,0,0,0,0,0,200,5,0,0,4,13,0,0,0,0,0,0,1,0,0,0,96,1,0,0,0,0,0,0,200,5,0,0,159,12,0,0,0,0,0,0,1,0,0,0,96,1,0,0,0,0,0,0,44,5,0,0,128,12,0,0,44,5,0,0,97,12,0,0,44,5,0,0,66,12,0,0,44,5,0,0,35,12,0,0,44,5,0,0,4,12,0,0,44,5,0,0,229,11,0,0,44,5,0,0,198,11,0,0,44,5,0,0,167,11,0,0,44,5,0,0,136,11,0,0,44,5,0,0,105,11,0,0,44,5,0,0,74,11,0,0,44,5,0,0,43,11,0,0,44,5,0,0,222,12,0,0,44,5,0,0,234,23,0,0,84,5,0,0,74,24,0,0,128,1,0,0,0,0,0,0,84,5,0,0,247,23,0,0,144,1,0,0,0,0,0,0,44,5,0,0,24,24,0,0,84,5,0,0,37,24,0,0,112,1,0,0,0,0,0,0,84,5,0,0,59,25,0,0,104,1,0,0,0,0,0,0,84,5,0,0,108,25,0,0,128,1,0,0,0,0,0,0,84,5,0,0,72,25,0,0,184,1,0,0,0,0,0,0,84,5,0,0,142,25,0,0,128,1,0,0,0,0,0,0,144,5,0,0,182,25,0,0,144,5,0,0,184,25,0,0,144,5,0,0,187,25,0,0,144,5,0,0,189,25,0,0,144,5,0,0,191,25,0,0,144,5,0,0,193,25,0,0,144,5,0,0,195,25,0,0,144,5,0,0,197,25,0,0,144,5,0,0,199,25,0,0,144,5,0,0,201,25,0,0,144,5,0,0,203,25,0,0,144,5,0,0,205,25,0,0,144,5,0,0,207,25,0,0,144,5,0,0,209,25,0,0,84,5,0,0,211,25,0,0,112,1,0,0,0,0,0,0,40,0,0,0,48,2,0,0,48,2,0,0,88,0,0,0,88,0,0,0,40,0,0,0,248,1,0,0,40,0,0,0,248,1,0,0,40,0,0,0,40,2,0,0,56,2,0,0,40,0,0,0,40,2,0,0,112,0,0,0,232,1,0,0,112,0,0,0,24,2,0,0,232,1,0,0,112,0,0,0,48,2,0,0,24,2,0,0,48,2,0,0,128,0,0,0,144,0,0,0,40,0,0,0,48,2,0,0,248,1,0,0,40,0,0,0,48,2,0,0,24,2,0,0,152,0,0,0,232,1,0,0,152,0,0,0,8,2,0,0,232,1,0,0,152,0,0,0,48,2,0,0,8,2,0,0,48,2,0,0,168,0,0,0,144,0,0,0,88,0,0,0,48,2,0,0,248,1,0,0,88,0,0,0,48,2,0,0,8,2,0,0,44,3,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,80,28,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,40,26,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,2,0,0,0,88,28,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,156,4,0,0,1,0,0,0,225,23,0,0,0,0,0,0,112,1,0,0,1,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,4,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,152,1,0,0,1,0,0,0,5,0,0,0,3,0,0,0,4,0,0,0,4,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,0,0,0,0,168,1,0,0,6,0,0,0,7,0,0,0,2,0,0,0,0,0,0,0,216,1,0,0,1,0,0,0,8,0,0,0,3,0,0,0,4,0,0,0,5,0,0,0,0,0,0,0,200,1,0,0,1,0,0,0,9,0,0,0,3,0,0,0,4,0,0,0,6,0,0,0,0,0,0,0,88,2,0,0,1,0,0,0,10,0,0,0,3,0,0,0,4,0,0,0,4,0,0,0,3,0,0,0,3,0,0,0,3,0,0,0,101,110,99,111,100,101,73,109,97,103,101,0,100,101,99,111,100,101,73,109,97,103,101,0,104,97,97,114,84,114,97,110,115,102,111,114,109,0,105,104,97,97,114,84,114,97,110,115,102,111,114,109,0,104,97,97,114,84,114,97,110,115,102,111,114,109,50,68,0,105,104,97,97,114,84,114,97,110,115,102,111,114,109,50,68,0,116,104,114,101,115,104,111,108,100,0,86,101,99,116,111,114,83,104,111,114,116,0,86,101,99,116,111,114,85,67,104,97,114,0,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,115,78,83,95,57,97,108,108,111,99,97,116,111,114,73,115,69,69,69,69,0,78,83,116,51,95,95,50,49,51,95,95,118,101,99,116,111,114,95,98,97,115,101,73,115,78,83,95,57,97,108,108,111,99,97,116,111,114,73,115,69,69,69,69,0,78,83,116,51,95,95,50,50,48,95,95,118,101,99,116,111,114,95,98,97,115,101,95,99,111,109,109,111,110,73,76,98,49,69,69,69,0,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,104,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,78,83,116,51,95,95,50,49,51,95,95,118,101,99,116,111,114,95,98,97,115,101,73,104,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,105,105,105,105,105,0,105,105,105,0,105,105,105,105,0,112,117,115,104,95,98,97,99,107,0,114,101,115,105,122,101,0,115,105,122,101,0,103,101,116,0,115,101,116,0,80,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,115,78,83,95,57,97,108,108,111,99,97,116,111,114,73,115,69,69,69,69,0,80,75,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,115,78,83,95,57,97,108,108,111,99,97,116,111,114,73,115,69,69,69,69,0,105,105,0,118,0,118,105,0,118,105,105,105,0,118,105,105,105,105,0,78,49,48,101,109,115,99,114,105,112,116,101,110,51,118,97,108,69,0,80,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,104,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,80,75,78,83,116,51,95,95,50,54,118,101,99,116,111,114,73,104,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,118,111,105,100,0,98,111,111,108,0,99,104,97,114,0,115,105,103,110,101,100,32,99,104,97,114,0,117,110,115,105,103,110,101,100,32,99,104,97,114,0,115,104,111,114,116,0,117,110,115,105,103,110,101,100,32,115,104,111,114,116,0,105,110,116,0,117,110,115,105,103,110,101,100,32,105,110,116,0,108,111,110,103,0,117,110,115,105,103,110,101,100,32,108,111,110,103,0,102,108,111,97,116,0,100,111,117,98,108,101,0,115,116,100,58,58,115,116,114,105,110,103,0,115,116,100,58,58,98,97,115,105,99,95,115,116,114,105,110,103,60,117,110,115,105,103,110,101,100,32,99,104,97,114,62,0,115,116,100,58,58,119,115,116,114,105,110,103,0,101,109,115,99,114,105,112,116,101,110,58,58,118,97,108,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,115,105,103,110,101,100,32,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,115,104,111,114,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,115,104,111,114,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,105,110,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,108,111,110,103,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,108,111,110,103,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,56,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,56,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,49,54,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,49,54,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,51,50,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,51,50,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,102,108,111,97,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,100,111,117,98,108,101,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,108,111,110,103,32,100,111,117,98,108,101,62,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,101,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,100,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,102,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,109,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,108,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,106,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,105,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,116,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,115,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,104,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,97,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,99,69,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,119,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,119,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,119,69,69,69,69,0,78,83,116,51,95,95,50,50,49,95,95,98,97,115,105,99,95,115,116,114,105,110,103,95,99,111,109,109,111,110,73,76,98,49,69,69,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,104,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,104,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,99,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,99,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,99,69,69,69,69,0,17,0,10,0,17,17,17,0,0,0,0,5,0,0,0,0,0,0,9,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,15,10,17,17,17,3,10,7,0,1,19,9,11,11,0,0,9,6,11,0,0,11,0,6,17,0,0,0,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,10,10,17,17,17,0,10,0,0,2,0,9,11,0,0,0,9,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,13,0,0,0,0,9,14,0,0,0,0,0,14,0,0,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,15,0,0,0,0,9,16,0,0,0,0,0,16,0,0,16,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,10,0,0,0,0,9,11,0,0,0,0,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,48,49,50,51,52,53,54,55,56,57,65,66,67,68,69,70,45,43,32,32,32,48,88,48,120,0,40,110,117,108,108,41,0,45,48,88,43,48,88,32,48,88,45,48,120,43,48,120,32,48,120,0,105,110,102,0,73,78,70,0,110,97,110,0,78,65,78,0,46,0,84,33,34,25,13,1,2,3,17,75,28,12,16,4,11,29,18,30,39,104,110,111,112,113,98,32,5,6,15,19,20,21,26,8,22,7,40,36,23,24,9,10,14,27,31,37,35,131,130,125,38,42,43,60,61,62,63,67,71,74,77,88,89,90,91,92,93,94,95,96,97,99,100,101,102,103,105,106,107,108,114,115,116,121,122,123,124,0,73,108,108,101,103,97,108,32,98,121,116,101,32,115,101,113,117,101,110,99,101,0,68,111,109,97,105,110,32,101,114,114,111,114,0,82,101,115,117,108,116,32,110,111,116,32,114,101,112,114,101,115,101,110,116,97,98,108,101,0,78,111,116,32,97,32,116,116,121,0,80,101,114,109,105,115,115,105,111,110,32,100,101,110,105,101,100,0,79,112,101,114,97,116,105,111,110,32,110,111,116,32,112,101,114,109,105,116,116,101,100,0,78,111,32,115,117,99,104,32,102,105,108,101,32,111,114,32,100,105,114,101,99,116,111,114,121,0,78,111,32,115,117,99,104,32,112,114,111,99,101,115,115,0,70,105,108,101,32,101,120,105,115,116,115,0,86,97,108,117,101,32,116,111,111,32,108,97,114,103,101,32,102,111,114,32,100,97,116,97,32,116,121,112,101,0,78,111,32,115,112,97,99,101,32,108,101,102,116,32,111,110,32,100,101,118,105,99,101,0,79,117,116,32,111,102,32,109,101,109,111,114,121,0,82,101,115,111,117,114,99,101,32,98,117,115,121,0,73,110,116,101,114,114,117,112,116,101,100,32,115,121,115,116,101,109,32,99,97,108,108,0,82,101,115,111,117,114,99,101,32,116,101,109,112,111,114,97,114,105,108,121,32,117,110,97,118,97,105,108,97,98,108,101,0,73,110,118,97,108,105,100,32,115,101,101,107,0,67,114,111,115,115,45,100,101,118,105,99,101,32,108,105,110,107,0,82,101,97,100,45,111,110,108,121,32,102,105,108,101,32,115,121,115,116,101,109,0,68,105,114,101,99,116,111,114,121,32,110,111,116,32,101,109,112,116,121,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,112,101,101,114,0,79,112,101,114,97,116,105,111,110,32,116,105,109,101,100,32,111,117,116,0,67,111,110,110,101,99,116,105,111,110,32,114,101,102,117,115,101,100,0,72,111,115,116,32,105,115,32,100,111,119,110,0,72,111,115,116,32,105,115,32,117,110,114,101,97,99,104,97,98,108,101,0,65,100,100,114,101,115,115,32,105,110,32,117,115,101,0,66,114,111,107,101,110,32,112,105,112,101,0,73,47,79,32,101,114,114,111,114,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,32,111,114,32,97,100,100,114,101,115,115,0,66,108,111,99,107,32,100,101,118,105,99,101,32,114,101,113,117,105,114,101,100,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,0,78,111,116,32,97,32,100,105,114,101,99,116,111,114,121,0,73,115,32,97,32,100,105,114,101,99,116,111,114,121,0,84,101,120,116,32,102,105,108,101,32,98,117,115,121,0,69,120,101,99,32,102,111,114,109,97,116,32,101,114,114,111,114,0,73,110,118,97,108,105,100,32,97,114,103,117,109,101,110,116,0,65,114,103,117,109,101,110,116,32,108,105,115,116,32,116,111,111,32,108,111,110,103,0,83,121,109,98,111,108,105,99,32,108,105,110,107,32,108,111,111,112,0,70,105,108,101,110,97,109,101,32,116,111,111,32,108,111,110,103,0,84,111,111,32,109,97,110,121,32,111,112,101,110,32,102,105,108,101,115,32,105,110,32,115,121,115,116,101,109,0,78,111,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,115,32,97,118,97,105,108,97,98,108,101,0,66,97,100,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,0,78,111,32,99,104,105,108,100,32,112,114,111,99,101,115,115,0,66,97,100,32,97,100,100,114,101,115,115,0,70,105,108,101,32,116,111,111,32,108,97,114,103,101,0,84,111,111,32,109,97,110,121,32,108,105,110,107,115,0,78,111,32,108,111,99,107,115,32,97,118,97,105,108,97,98,108,101,0,82,101,115,111,117,114,99,101,32,100,101,97,100,108,111,99,107,32,119,111,117,108,100,32,111,99,99,117,114,0,83,116,97,116,101,32,110,111,116,32,114,101,99,111,118,101,114,97,98,108,101,0,80,114,101,118,105,111,117,115,32,111,119,110,101,114,32,100,105,101,100,0,79,112,101,114,97,116,105,111,110,32,99,97,110,99,101,108,101,100,0,70,117,110,99,116,105,111,110,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,0,78,111,32,109,101,115,115,97,103,101,32,111,102,32,100,101,115,105,114,101,100,32,116,121,112,101,0,73,100,101,110,116,105,102,105,101,114,32,114,101,109,111,118,101,100,0,68,101,118,105,99,101,32,110,111,116,32,97,32,115,116,114,101,97,109,0,78,111,32,100,97,116,97,32,97,118,97,105,108,97,98,108,101,0,68,101,118,105,99,101,32,116,105,109,101,111,117,116,0,79,117,116,32,111,102,32,115,116,114,101,97,109,115,32,114,101,115,111,117,114,99,101,115,0,76,105,110,107,32,104,97,115,32,98,101,101,110,32,115,101,118,101,114,101,100,0,80,114,111,116,111,99,111,108,32,101,114,114,111,114,0,66,97,100,32,109,101,115,115,97,103,101,0,70,105,108,101,32,100,101,115,99,114,105,112,116,111,114,32,105,110,32,98,97,100,32,115,116,97,116,101,0,78,111,116,32,97,32,115,111,99,107,101,116,0,68,101,115,116,105,110,97,116,105,111,110,32,97,100,100,114,101,115,115,32,114,101,113,117,105,114,101,100,0,77,101,115,115,97,103,101,32,116,111,111,32,108,97,114,103,101,0,80,114,111,116,111,99,111,108,32,119,114,111,110,103,32,116,121,112,101,32,102,111,114,32,115,111,99,107,101,116,0,80,114,111,116,111,99,111,108,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,80,114,111,116,111,99,111,108,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,83,111,99,107,101,116,32,116,121,112,101,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,78,111,116,32,115,117,112,112,111,114,116,101,100,0,80,114,111,116,111,99,111,108,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,65,100,100,114,101,115,115,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,32,98,121,32,112,114,111,116,111,99,111,108,0,65,100,100,114,101,115,115,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,78,101,116,119,111,114,107,32,105,115,32,100,111,119,110,0,78,101,116,119,111,114,107,32,117,110,114,101,97,99,104,97,98,108,101,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,110,101,116,119,111,114,107,0,67,111,110,110,101,99,116,105,111,110,32,97,98,111,114,116,101,100,0,78,111,32,98,117,102,102,101,114,32,115,112,97,99,101,32,97,118,97,105,108,97,98,108,101,0,83,111,99,107,101,116,32,105,115,32,99,111,110,110,101,99,116,101,100,0,83,111,99,107,101,116,32,110,111,116,32,99,111,110,110,101,99,116,101,100,0,67,97,110,110,111,116,32,115,101,110,100,32,97,102,116,101,114,32,115,111,99,107,101,116,32,115,104,117,116,100,111,119,110,0,79,112,101,114,97,116,105,111,110,32,97,108,114,101,97,100,121,32,105,110,32,112,114,111,103,114,101,115,115,0,79,112,101,114,97,116,105,111,110,32,105,110,32,112,114,111,103,114,101,115,115,0,83,116,97,108,101,32,102,105,108,101,32,104,97,110,100,108,101,0,82,101,109,111,116,101,32,73,47,79,32,101,114,114,111,114,0,81,117,111,116,97,32,101,120,99,101,101,100,101,100,0,78,111,32,109,101,100,105,117,109,32,102,111,117,110,100,0,87,114,111,110,103,32,109,101,100,105,117,109,32,116,121,112,101,0,78,111,32,101,114,114,111,114,32,105,110,102,111,114,109,97,116,105,111,110,0,0,33,34,118,101,99,116,111,114,32,108,101,110,103,116,104,95,101,114,114,111,114,34,0,47,117,115,114,47,108,105,98,47,101,109,115,99,114,105,112,116,101,110,47,115,121,115,116,101,109,47,105,110,99,108,117,100,101,47,108,105,98,99,120,120,47,118,101,99,116,111,114,0,95,95,116,104,114,111,119,95,108,101,110,103,116,104,95,101,114,114,111,114,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,101,120,99,101,112,116,105,111,110,32,111,102,32,116,121,112,101,32,37,115,58,32,37,115,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,101,120,99,101,112,116,105,111,110,32,111,102,32,116,121,112,101,32,37,115,0,116,101,114,109,105,110,97,116,105,110,103,32,119,105,116,104,32,37,115,32,102,111,114,101,105,103,110,32,101,120,99,101,112,116,105,111,110,0,116,101,114,109,105,110,97,116,105,110,103,0,117,110,99,97,117,103,104,116,0,83,116,57,101,120,99,101,112,116,105,111,110,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,54,95,95,115,104,105,109,95,116,121,112,101,95,105,110,102,111,69,0,83,116,57,116,121,112,101,95,105,110,102,111,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,48,95,95,115,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,112,116,104,114,101,97,100,95,111,110,99,101,32,102,97,105,108,117,114,101,32,105,110,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,95,102,97,115,116,40,41,0,99,97,110,110,111,116,32,99,114,101,97,116,101,32,112,116,104,114,101,97,100,32,107,101,121,32,102,111,114,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,40,41,0,99,97,110,110,111,116,32,122,101,114,111,32,111,117,116,32,116,104,114,101,97,100,32,118,97,108,117,101,32,102,111,114,32,95,95,99,120,97,95,103,101,116,95,103,108,111,98,97,108,115,40,41,0,116,101,114,109,105,110,97,116,101,95,104,97,110,100,108,101,114,32,117,110,101,120,112,101,99,116,101,100,108,121,32,114,101,116,117,114,110,101,100,0,115,116,100,58,58,98,97,100,95,97,108,108,111,99,0,83,116,57,98,97,100,95,97,108,108,111,99,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,57,95,95,112,111,105,110,116,101,114,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,112,98,97,115,101,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,51,95,95,102,117,110,100,97,109,101,110,116,97,108,95,116,121,112,101,95,105,110,102,111,69,0,118,0,68,110,0,98,0,99,0,104,0,97,0,115,0,116,0,105,0,106,0,108,0,109,0,102,0,100,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,49,95,95,118,109,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);





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
   $160 = HEAP8[3458 + ($$0252 * 58 | 0) + $156 >> 0] | 0;
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
     $$1238 = 3938;
     $$2256 = $$0254;
     $$4266 = $$1263$;
     label = 76;
    } else {
     $280 = $15 - $$0$lcssa$i300 | 0;
     $$0228 = $$0$lcssa$i300;
     $$1233 = 0;
     $$1238 = 3938;
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
     $$0237 = 3938;
     $300 = $290;
     $301 = $291;
     label = 75;
     break L74;
    }
    if (!($$1263$ & 2048)) {
     $298 = $$1263$ & 1;
     $$0232 = $298;
     $$0237 = ($298 | 0) == 0 ? 3938 : 3940;
     $300 = $285;
     $301 = $288;
     label = 75;
    } else {
     $$0232 = 1;
     $$0237 = 3939;
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
    $$0237 = 3938;
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
    $$2239 = 3938;
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
    $$1 = $331 | 0 ? $331 : 3948;
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
     $$0521$i = 3955;
    } else {
     $378 = $$1263$ & 1;
     if (!($$1263$ & 2048)) {
      $$0471$i = $371;
      $$0520$i = $378;
      $$0521$i = ($378 | 0) == 0 ? 3956 : 3961;
     } else {
      $$0471$i = $371;
      $$0520$i = 1;
      $$0521$i = 3958;
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
       HEAP8[$$0523$i >> 0] = HEAPU8[3922 + $447 >> 0] | $410;
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
       ___fwritex(3990, 1, $0) | 0;
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
         ___fwritex(3990, 1, $0) | 0;
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
     if (!($398 & 32)) ___fwritex($$0471$i != $$0471$i | 0.0 != 0.0 ? ($389 ? 3982 : 3986) : $389 ? 3974 : 3978, 3, $0) | 0;
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
    $$2239 = 3938;
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
     HEAP8[$$056$i >> 0] = HEAPU8[3922 + ($229 & 15) >> 0] | $224;
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
   $$1238 = $or$cond282 ? 3938 : 3938 + ($$1236 >> 4) | 0;
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
   $$2239 = 3938;
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
  $8 = HEAP32[1683] | 0;
  $9 = $8 >>> $7;
  if ($9 & 3 | 0) {
   $14 = ($9 & 1 ^ 1) + $7 | 0;
   $16 = 6772 + ($14 << 1 << 2) | 0;
   $17 = $16 + 8 | 0;
   $18 = HEAP32[$17 >> 2] | 0;
   $19 = $18 + 8 | 0;
   $20 = HEAP32[$19 >> 2] | 0;
   do if (($16 | 0) == ($20 | 0)) HEAP32[1683] = $8 & ~(1 << $14); else {
    if ($20 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort();
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
  $37 = HEAP32[1685] | 0;
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
    $69 = 6772 + ($67 << 1 << 2) | 0;
    $70 = $69 + 8 | 0;
    $71 = HEAP32[$70 >> 2] | 0;
    $72 = $71 + 8 | 0;
    $73 = HEAP32[$72 >> 2] | 0;
    do if (($69 | 0) == ($73 | 0)) {
     $77 = $8 & ~(1 << $67);
     HEAP32[1683] = $77;
     $98 = $77;
    } else {
     if ($73 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort();
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
     $92 = HEAP32[1688] | 0;
     $93 = $37 >>> 3;
     $95 = 6772 + ($93 << 1 << 2) | 0;
     $96 = 1 << $93;
     if (!($98 & $96)) {
      HEAP32[1683] = $98 | $96;
      $$0199 = $95;
      $$pre$phiZ2D = $95 + 8 | 0;
     } else {
      $101 = $95 + 8 | 0;
      $102 = HEAP32[$101 >> 2] | 0;
      if ($102 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
       $$0199 = $102;
       $$pre$phiZ2D = $101;
      }
     }
     HEAP32[$$pre$phiZ2D >> 2] = $92;
     HEAP32[$$0199 + 12 >> 2] = $92;
     HEAP32[$92 + 8 >> 2] = $$0199;
     HEAP32[$92 + 12 >> 2] = $95;
    }
    HEAP32[1685] = $84;
    HEAP32[1688] = $87;
    $$0 = $72;
    STACKTOP = sp;
    return $$0 | 0;
   }
   $108 = HEAP32[1684] | 0;
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
    $134 = HEAP32[7036 + (($117 | $114 | $121 | $125 | $129) + ($127 >>> $129) << 2) >> 2] | 0;
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
    $151 = HEAP32[1687] | 0;
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
     $185 = 7036 + ($184 << 2) | 0;
     if (($$0190$i | 0) == (HEAP32[$185 >> 2] | 0)) {
      HEAP32[$185 >> 2] = $$3$i;
      if (!$$3$i) {
       HEAP32[1684] = $108 & ~(1 << $184);
       break;
      }
     } else {
      if ($156 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort();
      $193 = $156 + 16 | 0;
      if ((HEAP32[$193 >> 2] | 0) == ($$0190$i | 0)) HEAP32[$193 >> 2] = $$3$i; else HEAP32[$156 + 20 >> 2] = $$3$i;
      if (!$$3$i) break;
     }
     $198 = HEAP32[1687] | 0;
     if ($$3$i >>> 0 < $198 >>> 0) _abort();
     HEAP32[$$3$i + 24 >> 2] = $156;
     $202 = HEAP32[$$0190$i + 16 >> 2] | 0;
     do if ($202 | 0) if ($202 >>> 0 < $198 >>> 0) _abort(); else {
      HEAP32[$$3$i + 16 >> 2] = $202;
      HEAP32[$202 + 24 >> 2] = $$3$i;
      break;
     } while (0);
     $208 = HEAP32[$$0190$i + 20 >> 2] | 0;
     if ($208 | 0) if ($208 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
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
      $228 = HEAP32[1688] | 0;
      $229 = $37 >>> 3;
      $231 = 6772 + ($229 << 1 << 2) | 0;
      $232 = 1 << $229;
      if (!($8 & $232)) {
       HEAP32[1683] = $8 | $232;
       $$0187$i = $231;
       $$pre$phi$iZ2D = $231 + 8 | 0;
      } else {
       $236 = $231 + 8 | 0;
       $237 = HEAP32[$236 >> 2] | 0;
       if ($237 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
        $$0187$i = $237;
        $$pre$phi$iZ2D = $236;
       }
      }
      HEAP32[$$pre$phi$iZ2D >> 2] = $228;
      HEAP32[$$0187$i + 12 >> 2] = $228;
      HEAP32[$228 + 8 >> 2] = $$0187$i;
      HEAP32[$228 + 12 >> 2] = $231;
     }
     HEAP32[1685] = $$0191$i;
     HEAP32[1688] = $153;
    }
    $$0 = $$0190$i + 8 | 0;
    STACKTOP = sp;
    return $$0 | 0;
   }
  } else $$0197 = $6;
 } else if ($0 >>> 0 > 4294967231) $$0197 = -1; else {
  $245 = $0 + 11 | 0;
  $246 = $245 & -8;
  $247 = HEAP32[1684] | 0;
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
   $276 = HEAP32[7036 + ($$0356$i << 2) >> 2] | 0;
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
     $$4355$ph$i = HEAP32[7036 + (($313 | $310 | $317 | $321 | $325) + ($323 >>> $325) << 2) >> 2] | 0;
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
   if (!$$4$lcssa$i) $$0197 = $246; else if ($$4349$lcssa$i >>> 0 < ((HEAP32[1685] | 0) - $246 | 0) >>> 0) {
    $347 = HEAP32[1687] | 0;
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
     $381 = 7036 + ($380 << 2) | 0;
     if (($$4$lcssa$i | 0) == (HEAP32[$381 >> 2] | 0)) {
      HEAP32[$381 >> 2] = $$3370$i;
      if (!$$3370$i) {
       $386 = $247 & ~(1 << $380);
       HEAP32[1684] = $386;
       $470 = $386;
       break;
      }
     } else {
      if ($352 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort();
      $389 = $352 + 16 | 0;
      if ((HEAP32[$389 >> 2] | 0) == ($$4$lcssa$i | 0)) HEAP32[$389 >> 2] = $$3370$i; else HEAP32[$352 + 20 >> 2] = $$3370$i;
      if (!$$3370$i) {
       $470 = $247;
       break;
      }
     }
     $394 = HEAP32[1687] | 0;
     if ($$3370$i >>> 0 < $394 >>> 0) _abort();
     HEAP32[$$3370$i + 24 >> 2] = $352;
     $398 = HEAP32[$$4$lcssa$i + 16 >> 2] | 0;
     do if ($398 | 0) if ($398 >>> 0 < $394 >>> 0) _abort(); else {
      HEAP32[$$3370$i + 16 >> 2] = $398;
      HEAP32[$398 + 24 >> 2] = $$3370$i;
      break;
     } while (0);
     $404 = HEAP32[$$4$lcssa$i + 20 >> 2] | 0;
     if (!$404) $470 = $247; else if ($404 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
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
      $426 = 6772 + ($423 << 1 << 2) | 0;
      $427 = HEAP32[1683] | 0;
      $428 = 1 << $423;
      if (!($427 & $428)) {
       HEAP32[1683] = $427 | $428;
       $$0366$i = $426;
       $$pre$phi$i206Z2D = $426 + 8 | 0;
      } else {
       $432 = $426 + 8 | 0;
       $433 = HEAP32[$432 >> 2] | 0;
       if ($433 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
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
     $464 = 7036 + ($$0359$i << 2) | 0;
     HEAP32[$349 + 28 >> 2] = $$0359$i;
     $466 = $349 + 16 | 0;
     HEAP32[$466 + 4 >> 2] = 0;
     HEAP32[$466 >> 2] = 0;
     $468 = 1 << $$0359$i;
     if (!($470 & $468)) {
      HEAP32[1684] = $470 | $468;
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
     if ((label | 0) == 145) if ($487 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
      HEAP32[$487 >> 2] = $349;
      HEAP32[$349 + 24 >> 2] = $$0343$i;
      HEAP32[$349 + 12 >> 2] = $349;
      HEAP32[$349 + 8 >> 2] = $349;
      break;
     } else if ((label | 0) == 148) {
      $496 = $$0343$i + 8 | 0;
      $497 = HEAP32[$496 >> 2] | 0;
      $498 = HEAP32[1687] | 0;
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
 $506 = HEAP32[1685] | 0;
 if ($506 >>> 0 >= $$0197 >>> 0) {
  $508 = $506 - $$0197 | 0;
  $509 = HEAP32[1688] | 0;
  if ($508 >>> 0 > 15) {
   $511 = $509 + $$0197 | 0;
   HEAP32[1688] = $511;
   HEAP32[1685] = $508;
   HEAP32[$511 + 4 >> 2] = $508 | 1;
   HEAP32[$511 + $508 >> 2] = $508;
   HEAP32[$509 + 4 >> 2] = $$0197 | 3;
  } else {
   HEAP32[1685] = 0;
   HEAP32[1688] = 0;
   HEAP32[$509 + 4 >> 2] = $506 | 3;
   $520 = $509 + $506 + 4 | 0;
   HEAP32[$520 >> 2] = HEAP32[$520 >> 2] | 1;
  }
  $$0 = $509 + 8 | 0;
  STACKTOP = sp;
  return $$0 | 0;
 }
 $524 = HEAP32[1686] | 0;
 if ($524 >>> 0 > $$0197 >>> 0) {
  $526 = $524 - $$0197 | 0;
  HEAP32[1686] = $526;
  $527 = HEAP32[1689] | 0;
  $528 = $527 + $$0197 | 0;
  HEAP32[1689] = $528;
  HEAP32[$528 + 4 >> 2] = $526 | 1;
  HEAP32[$527 + 4 >> 2] = $$0197 | 3;
  $$0 = $527 + 8 | 0;
  STACKTOP = sp;
  return $$0 | 0;
 }
 if (!(HEAP32[1801] | 0)) {
  HEAP32[1803] = 4096;
  HEAP32[1802] = 4096;
  HEAP32[1804] = -1;
  HEAP32[1805] = -1;
  HEAP32[1806] = 0;
  HEAP32[1794] = 0;
  $538 = $1 & -16 ^ 1431655768;
  HEAP32[$1 >> 2] = $538;
  HEAP32[1801] = $538;
  $542 = 4096;
 } else $542 = HEAP32[1803] | 0;
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
 $546 = HEAP32[1793] | 0;
 if ($546 | 0) {
  $548 = HEAP32[1791] | 0;
  $549 = $548 + $544 | 0;
  if ($549 >>> 0 <= $548 >>> 0 | $549 >>> 0 > $546 >>> 0) {
   $$0 = 0;
   STACKTOP = sp;
   return $$0 | 0;
  }
 }
 L255 : do if (!(HEAP32[1794] & 4)) {
  $555 = HEAP32[1689] | 0;
  L257 : do if (!$555) label = 172; else {
   $$0$i17$i = 7180;
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
    $569 = HEAP32[1802] | 0;
    $570 = $569 + -1 | 0;
    $$$i = (($570 & $568 | 0) == 0 ? 0 : ($570 + $568 & 0 - $569) - $568 | 0) + $544 | 0;
    $578 = HEAP32[1791] | 0;
    $579 = $$$i + $578 | 0;
    if ($$$i >>> 0 > $$0197 >>> 0 & $$$i >>> 0 < 2147483647) {
     $582 = HEAP32[1793] | 0;
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
    $601 = HEAP32[1803] | 0;
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
  HEAP32[1794] = HEAP32[1794] | 4;
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
  $624 = (HEAP32[1791] | 0) + $$723947$i | 0;
  HEAP32[1791] = $624;
  if ($624 >>> 0 > (HEAP32[1792] | 0) >>> 0) HEAP32[1792] = $624;
  $627 = HEAP32[1689] | 0;
  do if (!$627) {
   $629 = HEAP32[1687] | 0;
   if (($629 | 0) == 0 | $$748$i >>> 0 < $629 >>> 0) HEAP32[1687] = $$748$i;
   HEAP32[1795] = $$748$i;
   HEAP32[1796] = $$723947$i;
   HEAP32[1798] = 0;
   HEAP32[1692] = HEAP32[1801];
   HEAP32[1691] = -1;
   $$01$i$i = 0;
   do {
    $634 = 6772 + ($$01$i$i << 1 << 2) | 0;
    HEAP32[$634 + 12 >> 2] = $634;
    HEAP32[$634 + 8 >> 2] = $634;
    $$01$i$i = $$01$i$i + 1 | 0;
   } while (($$01$i$i | 0) != 32);
   $640 = $$748$i + 8 | 0;
   $645 = ($640 & 7 | 0) == 0 ? 0 : 0 - $640 & 7;
   $646 = $$748$i + $645 | 0;
   $647 = $$723947$i + -40 - $645 | 0;
   HEAP32[1689] = $646;
   HEAP32[1686] = $647;
   HEAP32[$646 + 4 >> 2] = $647 | 1;
   HEAP32[$646 + $647 + 4 >> 2] = 40;
   HEAP32[1690] = HEAP32[1805];
  } else {
   $$024370$i = 7180;
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
    $678 = $$723947$i - $675 + (HEAP32[1686] | 0) | 0;
    HEAP32[1689] = $676;
    HEAP32[1686] = $678;
    HEAP32[$676 + 4 >> 2] = $678 | 1;
    HEAP32[$676 + $678 + 4 >> 2] = 40;
    HEAP32[1690] = HEAP32[1805];
    break;
   }
   $684 = HEAP32[1687] | 0;
   if ($$748$i >>> 0 < $684 >>> 0) {
    HEAP32[1687] = $$748$i;
    $749 = $$748$i;
   } else $749 = $684;
   $686 = $$748$i + $$723947$i | 0;
   $$124469$i = 7180;
   while (1) {
    if ((HEAP32[$$124469$i >> 2] | 0) == ($686 | 0)) {
     label = 208;
     break;
    }
    $690 = HEAP32[$$124469$i + 8 >> 2] | 0;
    if (!$690) {
     $$0$i$i$i = 7180;
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
     $724 = (HEAP32[1686] | 0) + $719 | 0;
     HEAP32[1686] = $724;
     HEAP32[1689] = $718;
     HEAP32[$718 + 4 >> 2] = $724 | 1;
    } else {
     if (($714 | 0) == (HEAP32[1688] | 0)) {
      $730 = (HEAP32[1685] | 0) + $719 | 0;
      HEAP32[1685] = $730;
      HEAP32[1688] = $718;
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
       $746 = 6772 + ($739 << 1 << 2) | 0;
       do if (($742 | 0) != ($746 | 0)) {
        if ($742 >>> 0 < $749 >>> 0) _abort();
        if ((HEAP32[$742 + 12 >> 2] | 0) == ($714 | 0)) break;
        _abort();
       } while (0);
       if (($744 | 0) == ($742 | 0)) {
        HEAP32[1683] = HEAP32[1683] & ~(1 << $739);
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
       $794 = 7036 + ($793 << 2) | 0;
       do if (($714 | 0) == (HEAP32[$794 >> 2] | 0)) {
        HEAP32[$794 >> 2] = $$3$i$i;
        if ($$3$i$i | 0) break;
        HEAP32[1684] = HEAP32[1684] & ~(1 << $793);
        break L326;
       } else {
        if ($765 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort();
        $803 = $765 + 16 | 0;
        if ((HEAP32[$803 >> 2] | 0) == ($714 | 0)) HEAP32[$803 >> 2] = $$3$i$i; else HEAP32[$765 + 20 >> 2] = $$3$i$i;
        if (!$$3$i$i) break L326;
       } while (0);
       $808 = HEAP32[1687] | 0;
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
       if ($818 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
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
      $835 = 6772 + ($832 << 1 << 2) | 0;
      $836 = HEAP32[1683] | 0;
      $837 = 1 << $832;
      do if (!($836 & $837)) {
       HEAP32[1683] = $836 | $837;
       $$0294$i$i = $835;
       $$pre$phi$i20$iZ2D = $835 + 8 | 0;
      } else {
       $841 = $835 + 8 | 0;
       $842 = HEAP32[$841 >> 2] | 0;
       if ($842 >>> 0 >= (HEAP32[1687] | 0) >>> 0) {
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
     $873 = 7036 + ($$0295$i$i << 2) | 0;
     HEAP32[$718 + 28 >> 2] = $$0295$i$i;
     $875 = $718 + 16 | 0;
     HEAP32[$875 + 4 >> 2] = 0;
     HEAP32[$875 >> 2] = 0;
     $877 = HEAP32[1684] | 0;
     $878 = 1 << $$0295$i$i;
     if (!($877 & $878)) {
      HEAP32[1684] = $877 | $878;
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
     if ((label | 0) == 275) if ($896 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
      HEAP32[$896 >> 2] = $718;
      HEAP32[$718 + 24 >> 2] = $$0288$i$i;
      HEAP32[$718 + 12 >> 2] = $718;
      HEAP32[$718 + 8 >> 2] = $718;
      break;
     } else if ((label | 0) == 278) {
      $905 = $$0288$i$i + 8 | 0;
      $906 = HEAP32[$905 >> 2] | 0;
      $907 = HEAP32[1687] | 0;
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
   } else $$0$i$i$i = 7180;
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
   HEAP32[1689] = $944;
   HEAP32[1686] = $945;
   HEAP32[$944 + 4 >> 2] = $945 | 1;
   HEAP32[$944 + $945 + 4 >> 2] = 40;
   HEAP32[1690] = HEAP32[1805];
   $951 = $933 + 4 | 0;
   HEAP32[$951 >> 2] = 27;
   HEAP32[$934 >> 2] = HEAP32[1795];
   HEAP32[$934 + 4 >> 2] = HEAP32[1796];
   HEAP32[$934 + 8 >> 2] = HEAP32[1797];
   HEAP32[$934 + 12 >> 2] = HEAP32[1798];
   HEAP32[1795] = $$748$i;
   HEAP32[1796] = $$723947$i;
   HEAP32[1798] = 0;
   HEAP32[1797] = $934;
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
     $966 = 6772 + ($963 << 1 << 2) | 0;
     $967 = HEAP32[1683] | 0;
     $968 = 1 << $963;
     if (!($967 & $968)) {
      HEAP32[1683] = $967 | $968;
      $$0211$i$i = $966;
      $$pre$phi$i$iZ2D = $966 + 8 | 0;
     } else {
      $972 = $966 + 8 | 0;
      $973 = HEAP32[$972 >> 2] | 0;
      if ($973 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
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
    $1004 = 7036 + ($$0212$i$i << 2) | 0;
    HEAP32[$627 + 28 >> 2] = $$0212$i$i;
    HEAP32[$627 + 20 >> 2] = 0;
    HEAP32[$931 >> 2] = 0;
    $1007 = HEAP32[1684] | 0;
    $1008 = 1 << $$0212$i$i;
    if (!($1007 & $1008)) {
     HEAP32[1684] = $1007 | $1008;
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
    if ((label | 0) == 301) if ($1026 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
     HEAP32[$1026 >> 2] = $627;
     HEAP32[$627 + 24 >> 2] = $$0207$i$i;
     HEAP32[$627 + 12 >> 2] = $627;
     HEAP32[$627 + 8 >> 2] = $627;
     break;
    } else if ((label | 0) == 304) {
     $1035 = $$0207$i$i + 8 | 0;
     $1036 = HEAP32[$1035 >> 2] | 0;
     $1037 = HEAP32[1687] | 0;
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
  $1045 = HEAP32[1686] | 0;
  if ($1045 >>> 0 > $$0197 >>> 0) {
   $1047 = $1045 - $$0197 | 0;
   HEAP32[1686] = $1047;
   $1048 = HEAP32[1689] | 0;
   $1049 = $1048 + $$0197 | 0;
   HEAP32[1689] = $1049;
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

function _free($0) {
 $0 = $0 | 0;
 var $$0211$i = 0, $$0211$in$i = 0, $$0381 = 0, $$0382 = 0, $$0394 = 0, $$0401 = 0, $$1 = 0, $$1380 = 0, $$1385 = 0, $$1388 = 0, $$1396 = 0, $$1400 = 0, $$2 = 0, $$3 = 0, $$3398 = 0, $$pre$phi439Z2D = 0, $$pre$phi441Z2D = 0, $$pre$phiZ2D = 0, $10 = 0, $105 = 0, $106 = 0, $114 = 0, $115 = 0, $123 = 0, $13 = 0, $131 = 0, $136 = 0, $137 = 0, $140 = 0, $142 = 0, $144 = 0, $159 = 0, $16 = 0, $164 = 0, $166 = 0, $169 = 0, $17 = 0, $172 = 0, $175 = 0, $178 = 0, $179 = 0, $180 = 0, $182 = 0, $184 = 0, $185 = 0, $187 = 0, $188 = 0, $194 = 0, $195 = 0, $2 = 0, $204 = 0, $209 = 0, $21 = 0, $212 = 0, $213 = 0, $219 = 0, $234 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $243 = 0, $244 = 0, $250 = 0, $255 = 0, $256 = 0, $259 = 0, $26 = 0, $261 = 0, $264 = 0, $269 = 0, $275 = 0, $279 = 0, $28 = 0, $280 = 0, $298 = 0, $3 = 0, $300 = 0, $307 = 0, $308 = 0, $309 = 0, $317 = 0, $41 = 0, $46 = 0, $48 = 0, $51 = 0, $53 = 0, $56 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $63 = 0, $65 = 0, $66 = 0, $68 = 0, $69 = 0, $7 = 0, $74 = 0, $75 = 0, $84 = 0, $89 = 0, $9 = 0, $92 = 0, $93 = 0, $99 = 0, label = 0;
 if (!$0) return;
 $2 = $0 + -8 | 0;
 $3 = HEAP32[1687] | 0;
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
  if (($16 | 0) == (HEAP32[1688] | 0)) {
   $105 = $10 + 4 | 0;
   $106 = HEAP32[$105 >> 2] | 0;
   if (($106 & 3 | 0) != 3) {
    $$1 = $16;
    $$1380 = $17;
    break;
   }
   HEAP32[1685] = $17;
   HEAP32[$105 >> 2] = $106 & -2;
   HEAP32[$16 + 4 >> 2] = $17 | 1;
   HEAP32[$16 + $17 >> 2] = $17;
   return;
  }
  $21 = $13 >>> 3;
  if ($13 >>> 0 < 256) {
   $24 = HEAP32[$16 + 8 >> 2] | 0;
   $26 = HEAP32[$16 + 12 >> 2] | 0;
   $28 = 6772 + ($21 << 1 << 2) | 0;
   if (($24 | 0) != ($28 | 0)) {
    if ($24 >>> 0 < $3 >>> 0) _abort();
    if ((HEAP32[$24 + 12 >> 2] | 0) != ($16 | 0)) _abort();
   }
   if (($26 | 0) == ($24 | 0)) {
    HEAP32[1683] = HEAP32[1683] & ~(1 << $21);
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
   $75 = 7036 + ($74 << 2) | 0;
   if (($16 | 0) == (HEAP32[$75 >> 2] | 0)) {
    HEAP32[$75 >> 2] = $$3;
    if (!$$3) {
     HEAP32[1684] = HEAP32[1684] & ~(1 << $74);
     $$1 = $16;
     $$1380 = $17;
     break;
    }
   } else {
    if ($46 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort();
    $84 = $46 + 16 | 0;
    if ((HEAP32[$84 >> 2] | 0) == ($16 | 0)) HEAP32[$84 >> 2] = $$3; else HEAP32[$46 + 20 >> 2] = $$3;
    if (!$$3) {
     $$1 = $16;
     $$1380 = $17;
     break;
    }
   }
   $89 = HEAP32[1687] | 0;
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
   } else if ($99 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
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
  if (($10 | 0) == (HEAP32[1689] | 0)) {
   $123 = (HEAP32[1686] | 0) + $$1380 | 0;
   HEAP32[1686] = $123;
   HEAP32[1689] = $$1;
   HEAP32[$$1 + 4 >> 2] = $123 | 1;
   if (($$1 | 0) != (HEAP32[1688] | 0)) return;
   HEAP32[1688] = 0;
   HEAP32[1685] = 0;
   return;
  }
  if (($10 | 0) == (HEAP32[1688] | 0)) {
   $131 = (HEAP32[1685] | 0) + $$1380 | 0;
   HEAP32[1685] = $131;
   HEAP32[1688] = $$1;
   HEAP32[$$1 + 4 >> 2] = $131 | 1;
   HEAP32[$$1 + $131 >> 2] = $131;
   return;
  }
  $136 = ($115 & -8) + $$1380 | 0;
  $137 = $115 >>> 3;
  do if ($115 >>> 0 < 256) {
   $140 = HEAP32[$10 + 8 >> 2] | 0;
   $142 = HEAP32[$10 + 12 >> 2] | 0;
   $144 = 6772 + ($137 << 1 << 2) | 0;
   if (($140 | 0) != ($144 | 0)) {
    if ($140 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort();
    if ((HEAP32[$140 + 12 >> 2] | 0) != ($10 | 0)) _abort();
   }
   if (($142 | 0) == ($140 | 0)) {
    HEAP32[1683] = HEAP32[1683] & ~(1 << $137);
    break;
   }
   if (($142 | 0) == ($144 | 0)) $$pre$phi439Z2D = $142 + 8 | 0; else {
    if ($142 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort();
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
    if ($$1400 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
     HEAP32[$$1400 >> 2] = 0;
     $$3398 = $$1396;
     break;
    }
   } else {
    $169 = HEAP32[$10 + 8 >> 2] | 0;
    if ($169 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort();
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
    $195 = 7036 + ($194 << 2) | 0;
    if (($10 | 0) == (HEAP32[$195 >> 2] | 0)) {
     HEAP32[$195 >> 2] = $$3398;
     if (!$$3398) {
      HEAP32[1684] = HEAP32[1684] & ~(1 << $194);
      break;
     }
    } else {
     if ($164 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort();
     $204 = $164 + 16 | 0;
     if ((HEAP32[$204 >> 2] | 0) == ($10 | 0)) HEAP32[$204 >> 2] = $$3398; else HEAP32[$164 + 20 >> 2] = $$3398;
     if (!$$3398) break;
    }
    $209 = HEAP32[1687] | 0;
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
    if ($219 | 0) if ($219 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
     HEAP32[$$3398 + 20 >> 2] = $219;
     HEAP32[$219 + 24 >> 2] = $$3398;
     break;
    }
   }
  } while (0);
  HEAP32[$$1 + 4 >> 2] = $136 | 1;
  HEAP32[$$1 + $136 >> 2] = $136;
  if (($$1 | 0) == (HEAP32[1688] | 0)) {
   HEAP32[1685] = $136;
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
  $237 = 6772 + ($234 << 1 << 2) | 0;
  $238 = HEAP32[1683] | 0;
  $239 = 1 << $234;
  if (!($238 & $239)) {
   HEAP32[1683] = $238 | $239;
   $$0401 = $237;
   $$pre$phiZ2D = $237 + 8 | 0;
  } else {
   $243 = $237 + 8 | 0;
   $244 = HEAP32[$243 >> 2] | 0;
   if ($244 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
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
 $275 = 7036 + ($$0394 << 2) | 0;
 HEAP32[$$1 + 28 >> 2] = $$0394;
 HEAP32[$$1 + 20 >> 2] = 0;
 HEAP32[$$1 + 16 >> 2] = 0;
 $279 = HEAP32[1684] | 0;
 $280 = 1 << $$0394;
 do if (!($279 & $280)) {
  HEAP32[1684] = $279 | $280;
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
  if ((label | 0) == 127) if ($298 >>> 0 < (HEAP32[1687] | 0) >>> 0) _abort(); else {
   HEAP32[$298 >> 2] = $$1;
   HEAP32[$$1 + 24 >> 2] = $$0382;
   HEAP32[$$1 + 12 >> 2] = $$1;
   HEAP32[$$1 + 8 >> 2] = $$1;
   break;
  } else if ((label | 0) == 130) {
   $307 = $$0382 + 8 | 0;
   $308 = HEAP32[$307 >> 2] | 0;
   $309 = HEAP32[1687] | 0;
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
 $317 = (HEAP32[1691] | 0) + -1 | 0;
 HEAP32[1691] = $317;
 if (!$317) $$0211$in$i = 7188; else return;
 while (1) {
  $$0211$i = HEAP32[$$0211$in$i >> 2] | 0;
  if (!$$0211$i) break; else $$0211$in$i = $$0211$i + 8 | 0;
 }
 HEAP32[1691] = -1;
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
 var $$0$i$i = 0, $$0$i$i$i$us = 0, $$0202$us = 0, $$090203$us = 0, $$091214 = 0, $$092211 = 0, $$pre$phi218Z2D = 0, $$sroa$0184$0207 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $104 = 0, $106 = 0, $108 = 0, $110 = 0, $111 = 0, $113 = 0, $115 = 0, $118 = 0, $119 = 0, $12 = 0, $125 = 0, $13 = 0, $137 = 0, $139 = 0, $14 = 0, $141 = 0, $142 = 0, $143 = 0, $145 = 0, $147 = 0, $148 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $154 = 0, $155 = 0, $157 = 0, $158 = 0, $16 = 0, $164 = 0, $165 = 0, $166 = 0, $169 = 0, $17 = 0, $170 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $28 = 0, $3 = 0, $30 = 0, $35 = 0, $37 = 0, $38 = 0, $4 = 0, $45 = 0, $46 = 0, $47 = 0, $49 = 0, $5 = 0, $6 = 0, $63 = 0, $65 = 0, $67 = 0, $68 = 0, $69 = 0, $71 = 0, $72 = 0, $74 = 0, $75 = 0, $8 = 0, $81 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $9 = 0, $91 = 0, $92 = 0, sp = 0;
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
  $$091214 = 0;
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
    $45 = (Math_imul($18, $$091214) | 0) + 2 | 0;
    $46 = HEAP32[$3 >> 2] | 0;
    $47 = HEAP32[$5 >> 2] | 0;
    $$092211 = 0;
    do {
     HEAP16[(HEAP32[$47 + ((($$092211 | 0) / ($13 | 0) | 0) * 12 | 0) >> 2] | 0) + ((($$092211 | 0) % ($13 | 0) | 0) << 1) >> 1] = HEAP16[$46 + ($45 + $$092211 << 1) >> 1] | 0;
     $$092211 = $$092211 + 1 | 0;
    } while (($$092211 | 0) < ($18 | 0));
   }
   $49 = (HEAP32[$4 >> 2] | 0) + ($$091214 * 12 | 0) | 0;
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
   $$091214 = $$091214 + 1 | 0;
   if (($$091214 | 0) >= ($10 | 0)) {
    $$pre$phi218Z2D = $4;
    break L1;
   }
  }
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($5);
 } else $$pre$phi218Z2D = $4; while (0);
 $24 = HEAP32[$$pre$phi218Z2D >> 2] | 0;
 $25 = $4 + 4 | 0;
 $26 = HEAP32[$25 >> 2] | 0;
 if (($24 | 0) != ($26 | 0)) {
  $$sroa$0184$0207 = $24;
  do {
   __Z16ihaarTransform2DRNSt3__26vectorINS0_IsNS_9allocatorIsEEEENS1_IS3_EEEE($$sroa$0184$0207) | 0;
   $$sroa$0184$0207 = $$sroa$0184$0207 + 12 | 0;
  } while (($$sroa$0184$0207 | 0) != ($26 | 0));
 }
 $84 = __Znwj(12) | 0;
 HEAP32[$84 >> 2] = 0;
 $85 = $84 + 4 | 0;
 HEAP32[$85 >> 2] = 0;
 $86 = $84 + 8 | 0;
 HEAP32[$86 >> 2] = 0;
 $87 = Math_imul($13, $13) | 0;
 L46 : do if ($87 | 0) if ($14) {
  $$090203$us = 0;
  L48 : while (1) {
   $91 = ($$090203$us | 0) / ($13 | 0) | 0;
   $92 = ($$090203$us | 0) % ($13 | 0) | 0;
   $$0202$us = 0;
   do {
    $100 = HEAP16[(HEAP32[(HEAP32[(HEAP32[$$pre$phi218Z2D >> 2] | 0) + ($$0202$us * 12 | 0) >> 2] | 0) + ($91 * 12 | 0) >> 2] | 0) + ($92 << 1) >> 1] & 255;
    $101 = HEAP32[$85 >> 2] | 0;
    $102 = HEAP32[$86 >> 2] | 0;
    $104 = $101;
    if ($101 >>> 0 < $102 >>> 0) {
     HEAP8[$101 >> 0] = $100;
     HEAP32[$85 >> 2] = (HEAP32[$85 >> 2] | 0) + 1;
    } else {
     $106 = HEAP32[$84 >> 2] | 0;
     $108 = $104 - $106 + 1 | 0;
     if (($108 | 0) < 0) break L48;
     $110 = $106;
     $111 = $102 - $106 | 0;
     $113 = $111 << 1;
     $$0$i$i$i$us = $111 >>> 0 < 1073741823 ? ($113 >>> 0 < $108 >>> 0 ? $108 : $113) : 2147483647;
     $115 = $104 - $106 | 0;
     if (!$$0$i$i$i$us) $119 = 0; else $119 = __Znwj($$0$i$i$i$us) | 0;
     $118 = $119 + $115 | 0;
     HEAP8[$118 >> 0] = $100;
     $125 = $118 + (0 - $115) | 0;
     if (($115 | 0) > 0) _memcpy($125 | 0, $110 | 0, $115 | 0) | 0;
     HEAP32[$84 >> 2] = $125;
     HEAP32[$85 >> 2] = $118 + 1;
     HEAP32[$86 >> 2] = $119 + $$0$i$i$i$us;
     if ($106 | 0) __ZdlPv($110);
    }
    $$0202$us = $$0202$us + 1 | 0;
   } while (($$0202$us | 0) < ($10 | 0));
   $$090203$us = $$090203$us + 1 | 0;
   if (($$090203$us | 0) >= ($87 | 0)) break L46;
  }
  __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($84);
 } while (0);
 if ($1 | 0) HEAP32[$1 >> 2] = $10;
 if ($2 | 0) HEAP32[$2 >> 2] = $13;
 $137 = HEAP32[$$pre$phi218Z2D >> 2] | 0;
 if ($137 | 0) {
  $139 = HEAP32[$25 >> 2] | 0;
  if (($139 | 0) == ($137 | 0)) $165 = $137; else {
   $142 = $139;
   while (1) {
    $141 = $142 + -12 | 0;
    HEAP32[$25 >> 2] = $141;
    $143 = HEAP32[$141 >> 2] | 0;
    if (!$143) $145 = $141; else {
     $147 = $142 + -8 | 0;
     $148 = HEAP32[$147 >> 2] | 0;
     if (($148 | 0) == ($143 | 0)) $164 = $143; else {
      $151 = $148;
      while (1) {
       $150 = $151 + -12 | 0;
       HEAP32[$147 >> 2] = $150;
       $152 = HEAP32[$150 >> 2] | 0;
       $154 = $152;
       if (!$152) $155 = $150; else {
        $157 = $151 + -8 | 0;
        $158 = HEAP32[$157 >> 2] | 0;
        if (($158 | 0) != ($152 | 0)) HEAP32[$157 >> 2] = $158 + (~(($158 + -2 - $154 | 0) >>> 1) << 1);
        __ZdlPv($152);
        $155 = HEAP32[$147 >> 2] | 0;
       }
       if (($155 | 0) == ($143 | 0)) break; else $151 = $155;
      }
      $164 = HEAP32[$141 >> 2] | 0;
     }
     __ZdlPv($164);
     $145 = HEAP32[$25 >> 2] | 0;
    }
    if (($145 | 0) == ($137 | 0)) break; else $142 = $145;
   }
   $165 = HEAP32[$4 >> 2] | 0;
  }
  __ZdlPv($165);
 }
 $166 = HEAP32[$3 >> 2] | 0;
 if (!$166) {
  STACKTOP = sp;
  return $84 | 0;
 }
 $169 = $3 + 4 | 0;
 $170 = HEAP32[$169 >> 2] | 0;
 if (($170 | 0) != ($166 | 0)) HEAP32[$169 >> 2] = $170 + (~(($170 + -2 - $166 | 0) >>> 1) << 1);
 __ZdlPv($166);
 STACKTOP = sp;
 return $84 | 0;
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
 __embind_register_void(488, 2062);
 __embind_register_bool(504, 2067, 1, 1, 0);
 __embind_register_integer(512, 2072, 1, -128, 127);
 __embind_register_integer(528, 2077, 1, -128, 127);
 __embind_register_integer(520, 2089, 1, 0, 255);
 __embind_register_integer(536, 2103, 2, -32768, 32767);
 __embind_register_integer(544, 2109, 2, 0, 65535);
 __embind_register_integer(552, 2124, 4, -2147483648, 2147483647);
 __embind_register_integer(560, 2128, 4, 0, -1);
 __embind_register_integer(568, 2141, 4, -2147483648, 2147483647);
 __embind_register_integer(576, 2146, 4, 0, -1);
 __embind_register_float(584, 2160, 4);
 __embind_register_float(592, 2166, 8);
 __embind_register_std_string(184, 2173);
 __embind_register_std_string(208, 2185);
 __embind_register_std_wstring(232, 4, 2218);
 __embind_register_emval(144, 2231);
 __embind_register_memory_view(256, 0, 2247);
 __embind_register_memory_view(264, 0, 2277);
 __embind_register_memory_view(272, 1, 2314);
 __embind_register_memory_view(280, 2, 2353);
 __embind_register_memory_view(288, 3, 2384);
 __embind_register_memory_view(296, 4, 2424);
 __embind_register_memory_view(304, 5, 2453);
 __embind_register_memory_view(312, 4, 2491);
 __embind_register_memory_view(320, 5, 2521);
 __embind_register_memory_view(264, 0, 2560);
 __embind_register_memory_view(272, 1, 2592);
 __embind_register_memory_view(280, 2, 2625);
 __embind_register_memory_view(288, 3, 2658);
 __embind_register_memory_view(296, 4, 2692);
 __embind_register_memory_view(304, 5, 2725);
 __embind_register_memory_view(328, 6, 2759);
 __embind_register_memory_view(336, 7, 2790);
 __embind_register_memory_view(344, 7, 2822);
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
 if (($0 | 0) == ($1 | 0) | ($1 | 0) == 496) $$4 = 1; else if (!$1) $$4 = 0; else {
  $9 = ___dynamic_cast($1, 384, 456, 0) | 0;
  if (!$9) $$4 = 0; else if (!(HEAP32[$9 + 8 >> 2] & ~HEAP32[$0 + 8 >> 2])) {
   $19 = HEAP32[$0 + 12 >> 2] | 0;
   $20 = $9 + 12 | 0;
   if (($19 | 0) == 488 ? 1 : ($19 | 0) == (HEAP32[$20 >> 2] | 0)) $$4 = 1; else if (!$19) $$4 = 0; else {
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
    HEAP32[$vararg_buffer7 >> 2] = HEAP32[328];
    _abort_message(6063, $vararg_buffer7);
   }
   if (($9 | 0) == 1126902529 & ($12 | 0) == 1129074247) $22 = HEAP32[$3 + 44 >> 2] | 0; else $22 = $3 + 80 | 0;
   HEAP32[$0 >> 2] = $22;
   $23 = HEAP32[$3 >> 2] | 0;
   $25 = HEAP32[$23 + 4 >> 2] | 0;
   if (FUNCTION_TABLE_iiii[HEAP32[(HEAP32[90] | 0) + 16 >> 2] & 15](360, $23, $0) | 0) {
    $30 = HEAP32[$0 >> 2] | 0;
    $31 = HEAP32[328] | 0;
    $35 = FUNCTION_TABLE_ii[HEAP32[(HEAP32[$30 >> 2] | 0) + 8 >> 2] & 15]($30) | 0;
    HEAP32[$vararg_buffer >> 2] = $31;
    HEAP32[$vararg_buffer + 4 >> 2] = $25;
    HEAP32[$vararg_buffer + 8 >> 2] = $35;
    _abort_message(5977, $vararg_buffer);
   } else {
    HEAP32[$vararg_buffer3 >> 2] = HEAP32[328];
    HEAP32[$vararg_buffer3 + 4 >> 2] = $25;
    _abort_message(6022, $vararg_buffer3);
   }
  }
 }
 _abort_message(6101, $vararg_buffer10);
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
  if (!(HEAP32[326] | 0)) $29 = 0; else $29 = _fflush(HEAP32[326] | 0) | 0;
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

function __ZN10emscripten15register_vectorIhEENS_6class_INSt3__26vectorIT_NS2_9allocatorIS4_EEEENS_8internal11NoBaseClassEEEPKc($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 __embind_register_class(88, 152, 168, 0, 1949, 9, 1952, 0, 1952, 0, $1 | 0, 1954, 12);
 __embind_register_class_constructor(88, 1, 740, 1949, 10, 2);
 $2 = __Znwj(8) | 0;
 HEAP32[$2 >> 2] = 2;
 HEAP32[$2 + 4 >> 2] = 0;
 __embind_register_class_function(88, 1844, 3, 744, 1957, 3, $2 | 0, 0);
 $3 = __Znwj(8) | 0;
 HEAP32[$3 >> 2] = 4;
 HEAP32[$3 + 4 >> 2] = 0;
 __embind_register_class_function(88, 1854, 4, 756, 1962, 5, $3 | 0, 0);
 $4 = __Znwj(8) | 0;
 HEAP32[$4 >> 2] = 11;
 HEAP32[$4 + 4 >> 2] = 0;
 __embind_register_class_function(88, 1861, 2, 772, 1835, 8, $4 | 0, 0);
 $5 = __Znwj(4) | 0;
 HEAP32[$5 >> 2] = 9;
 __embind_register_class_function(88, 1866, 3, 780, 1839, 12, $5 | 0, 0);
 $6 = __Znwj(4) | 0;
 HEAP32[$6 >> 2] = 13;
 __embind_register_class_function(88, 1870, 4, 792, 1829, 3, $6 | 0, 0);
 return;
}

function __ZN10emscripten15register_vectorIsEENS_6class_INSt3__26vectorIT_NS2_9allocatorIS4_EEEENS_8internal11NoBaseClassEEEPKc($0, $1) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 __embind_register_class(40, 112, 128, 0, 1949, 6, 1952, 0, 1952, 0, $1 | 0, 1954, 11);
 __embind_register_class_constructor(40, 1, 672, 1949, 7, 1);
 $2 = __Znwj(8) | 0;
 HEAP32[$2 >> 2] = 1;
 HEAP32[$2 + 4 >> 2] = 0;
 __embind_register_class_function(40, 1844, 3, 676, 1957, 1, $2 | 0, 0);
 $3 = __Znwj(8) | 0;
 HEAP32[$3 >> 2] = 2;
 HEAP32[$3 + 4 >> 2] = 0;
 __embind_register_class_function(40, 1854, 4, 688, 1962, 4, $3 | 0, 0);
 $4 = __Znwj(8) | 0;
 HEAP32[$4 >> 2] = 8;
 HEAP32[$4 + 4 >> 2] = 0;
 __embind_register_class_function(40, 1861, 2, 704, 1835, 6, $4 | 0, 0);
 $5 = __Znwj(4) | 0;
 HEAP32[$5 >> 2] = 7;
 __embind_register_class_function(40, 1866, 3, 712, 1839, 10, $5 | 0, 0);
 $6 = __Znwj(4) | 0;
 HEAP32[$6 >> 2] = 11;
 __embind_register_class_function(40, 1870, 4, 724, 1829, 2, $6 | 0, 0);
 return;
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
  if ((HEAPU8[3992 + $$016 >> 0] | 0) == ($0 | 0)) {
   label = 2;
   break;
  }
  $7 = $$016 + 1 | 0;
  if (($7 | 0) == 87) {
   $$01214 = 4080;
   $$115 = 87;
   label = 5;
   break;
  } else $$016 = $7;
 }
 if ((label | 0) == 2) if (!$$016) $$012$lcssa = 4080; else {
  $$01214 = 4080;
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
 $$sroa$0$0 = __emval_take_value(536, $2 | 0) | 0;
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
 $$sroa$0$0 = __emval_take_value(520, $2 | 0) | 0;
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

function __ZN38EmscriptenBindingInitializer_my_moduleC2Ev($0) {
 $0 = $0 | 0;
 __embind_register_function(1512, 4, 616, 1829, 1, 7);
 __embind_register_function(1524, 2, 632, 1835, 1, 3);
 __embind_register_function(1536, 2, 640, 1835, 2, 4);
 __embind_register_function(1550, 2, 640, 1835, 2, 5);
 __embind_register_function(1565, 3, 648, 1839, 8, 3);
 __embind_register_function(1581, 3, 648, 1839, 8, 4);
 __embind_register_function(1598, 3, 660, 1839, 9, 5);
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

function __GLOBAL__sub_I_haar_cpp() {
 var $0 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 $0 = sp;
 __ZN38EmscriptenBindingInitializer_my_moduleC2Ev(0);
 __ZN10emscripten15register_vectorIsEENS_6class_INSt3__26vectorIT_NS2_9allocatorIS4_EEEENS_8internal11NoBaseClassEEEPKc($0, 1608);
 __ZN10emscripten15register_vectorIhEENS_6class_INSt3__26vectorIT_NS2_9allocatorIS4_EEEENS_8internal11NoBaseClassEEEPKc($0, 1620);
 STACKTOP = sp;
 return;
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

function __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0, $1, $2, $3) {
 $0 = $0 | 0;
 $1 = $1 | 0;
 $2 = $2 | 0;
 $3 = $3 | 0;
 if (($0 | 0) == (HEAP32[$1 + 8 >> 2] | 0)) __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0, $1, $2, $3);
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
 $2 = HEAP32[202] | 0;
 _vfprintf($2, $0, $1) | 0;
 _fputc(10, $2) | 0;
 _abort();
}

function ___cxa_get_globals_fast() {
 var $3 = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16 | 0;
 if (!(_pthread_once(7228, 2) | 0)) {
  $3 = _pthread_getspecific(HEAP32[1808] | 0) | 0;
  STACKTOP = sp;
  return $3 | 0;
 } else _abort_message(6252, sp);
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
 if (!(_pthread_setspecific(HEAP32[1808] | 0, 0) | 0)) {
  STACKTOP = sp;
  return;
 } else _abort_message(6351, sp);
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
 if (!(_pthread_key_create(7232, 13) | 0)) {
  STACKTOP = sp;
  return;
 } else _abort_message(6301, sp);
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
 _abort_message(6404, sp);
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
 if (!$0) $4 = 0; else $4 = (___dynamic_cast($0, 384, 456, 0) | 0) != 0;
 return $4 & 1 | 0;
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

function __ZNKSt3__220__vector_base_commonILb1EE20__throw_length_errorEv($0) {
 $0 = $0 | 0;
 ___assert_fail(5884, 5907, 304, 5956);
}

function _llvm_bswap_i32(x) {
 x = x | 0;
 return (x & 255) << 24 | (x >> 8 & 255) << 16 | (x >> 16 & 255) << 8 | x >>> 24 | 0;
}

function __ZN10emscripten8internal13getActualTypeINSt3__26vectorIsNS2_9allocatorIsEEEEEEPKvPT_($0) {
 $0 = $0 | 0;
 return 40;
}

function __ZN10emscripten8internal13getActualTypeINSt3__26vectorIhNS2_9allocatorIhEEEEEEPKvPT_($0) {
 $0 = $0 | 0;
 return 88;
}

function dynCall_ii(index, a1) {
 index = index | 0;
 a1 = a1 | 0;
 return FUNCTION_TABLE_ii[index & 15](a1 | 0) | 0;
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
 $0 = HEAP32[1809] | 0;
 HEAP32[1809] = $0 + 0;
 return $0 | 0;
}

function __ZSt13get_terminatev() {
 var $0 = 0;
 $0 = HEAP32[327] | 0;
 HEAP32[327] = $0 + 0;
 return $0 | 0;
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

function ___clang_call_terminate($0) {
 $0 = $0 | 0;
 ___cxa_begin_catch($0 | 0) | 0;
 __ZSt9terminatev();
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
 HEAP32[$0 >> 2] = 1404;
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
 return 6444;
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

function _dummy_515($0) {
 $0 = $0 | 0;
 return $0 | 0;
}

function _emscripten_get_global_libc() {
 return 6656;
}

function ___ofl_lock() {
 ___lock(6720);
 return 6728;
}

function b5(p0) {
 p0 = p0 | 0;
 abort(5);
 return 0;
}

function ___ofl_unlock() {
 ___unlock(6720);
 return;
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
 return 936;
}

function b2() {
 abort(2);
 return 0;
}

function b7() {
 abort(7);
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_iiii = [b0,___stdio_write,___stdio_seek,___stdout_write,__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv,__ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv,__ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv,__Z11encodeImagejjRNSt3__26vectorIhNS_9allocatorIhEEEE,__ZN10emscripten8internal7InvokerIbJRNSt3__26vectorIsNS2_9allocatorIsEEEEiEE6invokeEPFbS7_iEPS6_i,__ZN10emscripten8internal7InvokerIlJRNSt3__26vectorIsNS2_9allocatorIsEEEEiEE6invokeEPFlS7_iEPS6_i,__ZN10emscripten8internal15FunctionInvokerIPFNS_3valERKNSt3__26vectorIsNS3_9allocatorIsEEEEjES2_S9_JjEE6invokeEPSB_PS7_j,__ZN10emscripten8internal12VectorAccessINSt3__26vectorIsNS2_9allocatorIsEEEEE3setERS6_jRKs,__ZN10emscripten8internal15FunctionInvokerIPFNS_3valERKNSt3__26vectorIhNS3_9allocatorIhEEEEjES2_S9_JjEE6invokeEPSB_PS7_j,__ZN10emscripten8internal12VectorAccessINSt3__26vectorIhNS2_9allocatorIhEEEEE3setERS6_jRKh,b0,b0];
var FUNCTION_TABLE_viiiii = [b1,__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib];
var FUNCTION_TABLE_i = [b2,__ZN10emscripten8internal12operator_newINSt3__26vectorIsNS2_9allocatorIsEEEEJEEEPT_DpOT0_,__ZN10emscripten8internal12operator_newINSt3__26vectorIhNS2_9allocatorIhEEEEJEEEPT_DpOT0_,b2];
var FUNCTION_TABLE_vi = [b3,__ZN10__cxxabiv116__shim_type_infoD2Ev,__ZN10__cxxabiv117__class_type_infoD0Ev,__ZNK10__cxxabiv116__shim_type_info5noop1Ev,__ZNK10__cxxabiv116__shim_type_info5noop2Ev,__ZN10__cxxabiv120__si_class_type_infoD0Ev,__ZNSt9bad_allocD2Ev,__ZNSt9bad_allocD0Ev,__ZN10__cxxabiv123__fundamental_type_infoD0Ev,__ZN10__cxxabiv119__pointer_type_infoD0Ev,__ZN10__cxxabiv121__vmi_class_type_infoD0Ev,__ZN10emscripten8internal14raw_destructorINSt3__26vectorIsNS2_9allocatorIsEEEEEEvPT_,__ZN10emscripten8internal14raw_destructorINSt3__26vectorIhNS2_9allocatorIhEEEEEEvPT_,__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv,b3,b3];
var FUNCTION_TABLE_vii = [b4,__ZNSt3__26vectorIsNS_9allocatorIsEEE9push_backERKs,__ZNSt3__26vectorIhNS_9allocatorIhEEE9push_backERKh,b4];
var FUNCTION_TABLE_ii = [b5,___stdio_close,__ZNKSt9bad_alloc4whatEv,__Z12decodeImageWNSt3__210unique_ptrINS_6vectorIsNS_9allocatorIsEEEENS_14default_deleteIS4_EEEE,__Z13haarTransformRNSt3__26vectorIsNS_9allocatorIsEEEE,__Z14ihaarTransformRNSt3__26vectorIsNS_9allocatorIsEEEE,__ZN10emscripten8internal13getActualTypeINSt3__26vectorIsNS2_9allocatorIsEEEEEEPKvPT_,__ZN10emscripten8internal7InvokerIPNSt3__26vectorIsNS2_9allocatorIsEEEEJEE6invokeEPFS7_vE,__ZNKSt3__26vectorIsNS_9allocatorIsEEE4sizeEv,__ZN10emscripten8internal13getActualTypeINSt3__26vectorIhNS2_9allocatorIhEEEEEEPKvPT_,__ZN10emscripten8internal7InvokerIPNSt3__26vectorIhNS2_9allocatorIhEEEEJEE6invokeEPFS7_vE,__ZNKSt3__26vectorIhNS_9allocatorIhEEE4sizeEv,b5,b5,b5,b5];
var FUNCTION_TABLE_viii = [b6,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIsNS2_9allocatorIsEEEEFvRKsEvPS6_JS8_EE6invokeERKSA_SB_s,__ZNSt3__26vectorIsNS_9allocatorIsEEE6resizeEjRKs,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIhNS2_9allocatorIhEEEEFvRKhEvPS6_JS8_EE6invokeERKSA_SB_h,__ZNSt3__26vectorIhNS_9allocatorIhEEE6resizeEjRKh,b6,b6,b6];
var FUNCTION_TABLE_v = [b7,__ZL25default_terminate_handlerv,__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev,b7];
var FUNCTION_TABLE_iiiii = [b8,__ZN10emscripten8internal7InvokerINSt3__210unique_ptrINS2_6vectorIsNS2_9allocatorIsEEEENS2_14default_deleteIS7_EEEEJjjRNS4_IhNS5_IhEEEEEE6invokeEPFSA_jjSD_EjjPSC_,__ZN10emscripten8internal15FunctionInvokerIPFbRNSt3__26vectorIsNS2_9allocatorIsEEEEjRKsEbS7_JjS9_EE6invokeEPSB_PS6_js,__ZN10emscripten8internal15FunctionInvokerIPFbRNSt3__26vectorIhNS2_9allocatorIhEEEEjRKhEbS7_JjS9_EE6invokeEPSB_PS6_jh];
var FUNCTION_TABLE_viiiiii = [b9,__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib];
var FUNCTION_TABLE_iii = [b10,__ZN10emscripten8internal7InvokerINSt3__210unique_ptrINS2_6vectorIhNS2_9allocatorIhEEEENS2_14default_deleteIS7_EEEEJNS3_INS4_IsNS5_IsEEEENS8_ISC_EEEEEE6invokeEPFSA_SE_EPSC_,__ZN10emscripten8internal7InvokerIbJRNSt3__26vectorIsNS2_9allocatorIsEEEEEE6invokeEPFbS7_EPS6_,__Z19haarTransform2DFlatRNSt3__26vectorIsNS_9allocatorIsEEEEi,__Z20ihaarTransform2DFlatRNSt3__26vectorIsNS_9allocatorIsEEEEi,__Z9thresholdRNSt3__26vectorIsNS_9allocatorIsEEEEi,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIsNS2_9allocatorIsEEEEKFjvEjPKS6_JEE6invokeERKS8_SA_,__ZN10emscripten8internal12VectorAccessINSt3__26vectorIsNS2_9allocatorIsEEEEE3getERKS6_j,__ZN10emscripten8internal13MethodInvokerIMNSt3__26vectorIhNS2_9allocatorIhEEEEKFjvEjPKS6_JEE6invokeERKS8_SA_,__ZN10emscripten8internal12VectorAccessINSt3__26vectorIhNS2_9allocatorIhEEEEE3getERKS6_j,b10,b10,b10,b10,b10,b10];
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






