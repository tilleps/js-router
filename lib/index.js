"use strict";

(function(name, definition) {
    if (typeof module != 'undefined') module.exports = definition();
    else if (typeof define == 'function' && typeof define.amd == 'object') define(definition);
    else window[name] = definition();
}('Router', function() {

  /**
   * To work properly with the URL
   * history.location generated polyfill in https://github.com/devote/HTML5-History-API
   */
  var location = window.history.location || window.location;
  
  
  /**
   * Set Value in JSON object
   * 
   * @param {Object} obj
   * @param {String} path
   * @param {Mixed} value
   * @return {Object}
   */
  function setObjectValue(obj, path, value) {
    var part;
    var parts = path.replace(/\[(.*?)\]/g, "&$1").split("&");      
    var last = parts.pop();
  
    var isArray = false;

    if (last == '') isArray = true;       
    else parts.push(last);       
  
  
    while(typeof (part = parts.shift()) != 'undefined') {
    
        if (parts.length == 0) {
        
          if (isArray) {
            if (toString.call(obj[part]) != '[object Array]') obj[part] = [];
            obj[part].push(value);
          } else {
            obj[part] = value; 
          }
        
        } else {
          if( typeof obj[part] != "object") obj[part] = {};          
        }
      
        obj = obj[part];
    }
  
    return obj;
  }

  
  /**
   * Parse Query
   *
   * @param {String} querystring
   * @return {Object}
   */
  function parseQuery(querystring) {
    var query = {};
    var parts = querystring.split('&');
  
    for (var i = 0; i < parts.length; i++ ) {
      var part = parts[i];
      var key = decodeURIComponent(part.substr(0, part.indexOf('=')));
      var value = part.substr(part.indexOf('=') + 1);

      setObjectValue(query, key, value);
    
    }
  
    return query;
  }

  
  /**
   * Return normalized event object
   *
   * @param {Object} e
   * @return {Object}
   */
  function which(e) {
    e = e || window.event;
    return null === e.which
      ? e.button
      : e.which;
  }


  /**
   * Determine if URL is from same origin
   *
   * @param {String} href
   * @return {Boolean}
   */
  function sameOrigin(href) {
    var origin = location.protocol + '//' + location.hostname;
    if (location.port) origin += ':' + location.port;
    return (href && (0 === href.indexOf(origin)));
  }

  
  /**
   * Strip Same Origin
   * 
   * @param {String} href
   * @return {String}
   */
  function stripSameOrigin(href) {
  
    //  Check if same origin
    var origin = location.protocol + '//' + location.hostname;
    if (location.port) origin += ':' + location.port;
  
    //  ignore requests that are not same origin
    if (!~href.indexOf(origin)) return;
  
    return href.substr(origin.length);
  }


  /**
   * Route
   * 
   * AKA Context from page.js
   * 
   * @constructor
   * @param {String} path
   * @param {Object} options OPTIONAL
   * @return {Route}
   */
  var Route = function (path, options) {
    options = options || {};
  
    this.base = options.base || '';
    this.path = (path === '*') ? '(.*)' : path;
    this.keys = [];
    this.regPath = pathtoRegexp(this.path, this.keys);
  }

  
  /**
   * Middleware Processor
   *
   * @param {Function} fn
   * @return {Function}
   */
  Route.prototype.middleware = function (fn) {
    var self = this;
    return function (req, res, next) {
      if (self.match(req.path, req.params)) return fn(req, res, next);
      next();
    }
  }


  /**
   * Match Path
   * 
   * Base URL can be specified which will allow relative paths
   * 
   * @param {String} path
   * @param {Object} params
   * @return {Boolean}
   */
  Route.prototype.match = function (path, params) {
    
    //  strip base URL
    if (path.indexOf(this.base) === 0) {
      path = path.substr(this.base.length);
    }
    
    
    var match = this.regPath.exec(decodeURIComponent(path));
  
    if (!match) return false;
  
  
    for (var i = 1, length = match.length; i < length; i++) {
      var key = this.keys[i - 1];
    
      var value = (typeof match[i] == 'string')
        ? decodeURIComponent(match[i])
        : match[i];
    
      if (key) {
        params[key.name] = typeof params[key.name] == 'undefined'
          ? value
          : params[key.name];
      } else {
        params.push(value);
      }
    
    }
  
    return true;  
  }

  
  /**
   * Request
   *
   * @constructor
   * @param {String} path
   * @param {Object} options
   * @return {Request}
   */
  var Request = function (path, options) {
    options = options || {};
    
    path = path || '';
    
    var posHash = path.indexOf('#');
    var pathname = path.substr(0, posHash);  
    var indexSearch = pathname.indexOf('?');
  
    var posSearch = pathname.indexOf('?');
    var querystring = ~posSearch
      ? pathname.substr(posSearch + 1)
      : '';
  
    var query = parseQuery(querystring);

    pathname = pathname.substr(0, path.indexOf('?'));
  
    //  Get hash information
    var hash = path.substr(path.indexOf('#'));
    var hashquerystring = hash.substr(hash.indexOf('?') + 1);
    var hashquery = parseQuery(hashquerystring);

    path = pathname + ((querystring.length > 0) ? '?' + querystring : '') + hash;

  
    this.state = options.state || {};
    this.state.path = path;  
  
    this.path = path;
    this.pathname = pathname;
    
    this.query = query;
    this.querystring = querystring;
    
    this.hash = hash;
    this.hashquery = hashquery;
    this.hashquerystring = hashquerystring;
  
    this.title = options.title || document.title;

    this.params = [];
  }

  
  /**
   * Get Param Value
   * 
   * @param {String} key
   * @param {Mixed} defaultValue
   * @return {Mixed}
   */
  Request.prototype.get = function (key, defaultValue) {
    return (this.params && typeof this.params[key] !== 'undefined')
      ? this.params[key]
      : (this.query && typeof this.query[key] !== 'undefined')
        ? this.query[key]
        : defaultValue;
  }

  
  /**
   * Push State
   *
   * @return {Request}
   */
  Request.prototype.pushState = function () {
    history.pushState(this.state, this.title, this.path);
    return this;
  }
  
  
  /**
   * Save State
   *
   * @return {Request}
   */
  Request.prototype.saveState = function () {
    history.replaceState(this.state, this.title, this.path);
    return this;
  }


  /**
   * Router
   * 
   * Available options:
   *   - dispatch
   *   - base
   *   - title
   * 
   * @constructor
   * @param {Object} options
   * @return Router
   */
  var Router = function (options) {
    
    options = options || {};
  
    this._callbacks = [];
    this._exits = [];
    
    this._errors = {};

    //  dispatch requests flag
    this._running = options.dispatch || true;
  
    //  base url
    this.base = options.base || '';
  
    //  default document title
    this.title = options.title || document.title;
    
    //  response object
    this.response = options.response || {};
  }


  /**
   * Popstate Event Handler
   *
   * @param {Event} e
   * @return {void}
   */
  Router.prototype.onpopstate = function (e) {
  
    if (e.state) {
      var path = e.state.path;
      router.goto(path, e.state);
    }

    else {
    
      var part = [location.protocol, '://', location.host].join('');
    
      var l = location;    
      var url = l.pathname + l.search + l.hash;
      
      
      this.goto(url);
      
    }
  
  }

  
  /**
   * Onclick Event Handler
   *
   * @param {Event} e
   * @return {void}
   */
  Router.prototype.onclick = function (e) {

    if (1 != which(e)) return;
  
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (e.defaultPrevented) return;
  

    // ensure link
    var el = e.target;
    while (el && 'A' != el.nodeName) el = el.parentNode;
    if (!el || 'A' != el.nodeName) return;

    // ensure non-hash for the same path
    var link = el.getAttribute('href');
    
    // Check for mailto: in the href
    if (link && link.indexOf("mailto:") > -1) return;

    // check target
    if (el.target) return;

    // x-origin
    if (!sameOrigin(el.href)) return;
    
    var href = stripSameOrigin(el.href);
    
    
    e.preventDefault();
  
  
    this.show(href);
  }


  /**
   * Dispatch
   * 
   * @param {Request} req
   * @return {void}
   */
  Router.prototype.dispatch = function (req, res) {
    
    
    var i = 0;
    var j = 0;
    var self = this;
    
    var previousRequest = self.previousRequest;
    
    self.previousRequest = req;
    
    
    function next() {
    
      var fn;
      if (arguments.length > 0) {
        var code = arguments[0] || 500;
      
        fn = self._errors[code];
        if (!fn) {
          throw arguments[0];
        }
        
        self._errors[code](arguments[0], req, res);
        return;
      }
    
    
      var fn = self._callbacks[i++];
      if (!fn) {
        
        if (self._errors.hasOwnProperty('404')) {
          self._errors['404'](arguments[0], req, res);
        } else {
          //  No more callbacks, 404 not defined
          throw new Error('no more callbacks, 404 not defined');
        }
        return;
      }
      
      try {
        fn(req, res, next);
      }
      catch (err) {
        
        if (self._errors.hasOwnProperty('501')) {
          self._errors['500'](err, req, res);
        } else {
          //  No more callbacks, 500 not defined
          console.log(err.stack);
        }
        
      }
    }
    
    
    function nextExit() {
      var fn = self._exits[j++];
      if (!fn) return next();
      fn(previousRequest, res, nextExit);
    }
    
    
    if (previousRequest) {
      nextExit();
    } else {
      next();
    }
    
  }

  
  /**
   * Route
   *
   * @param {String} path
   * @param {Function| fn
   * @return {Router}
   */
  Router.prototype.route = function (path, fn) {
    var options = {
      base: this.base
    };
  
    var route = new Route(path, options);
    for (var i = 1; i < arguments.length; ++i) {
      this._callbacks.push(route.middleware(arguments[i]));
    }
    
    return this;
  }


  /**
   * Show Route
   *
   * To be used with clicking route (URL update)
   *
   * @param {String} path
   * @param {Object} state
   * @return {Request}
   */
  Router.prototype.show = function (path, state) {
  
    var options = {
      state: state,
      title: this.title
    }
  
    var req = new Request(path, options);
    var res = this.response;
    
    if (this._running) this.dispatch(req, res);
  
    //  Set title
    document.title = req.title;
    
    req.pushState();
  
    return req;
  }


  /**
   * Router Set Location
   * AKA Router.replace in page.js
   * 
   * Intended to be used when the URL hasn't been changed
   * 
   * @param {String} path
   * @param {Object} state
   * @return {Request}
   */
  Router.prototype.go = 
  Router.prototype.goto = function (path, state) {
  
    var options = {
      state: state,
      title: this.title
    }
  
    var req = new Request(path, options);
    var res = this.response;
    
    if (this._running) this.dispatch(req, res);

    //  Set title
    document.title = req.title;

    req.saveState();
  
    return req;
  }
  
  
  /**
   * Redirect
   *
   * @param {String} from
   * @param {String [to]
   * @return Router
   */
  Router.prototype.redirect = function (from, to) {
    var self = this;
    
    if (typeof from === 'string' && typeof to === 'string') {
      self.route(from, function (e) {
        setTimeout(function () {
          self.go(to);
        }, 0);
      });
      
      return self;
    }
    
    if (typeof from === 'string' && typeof to === 'undefined') {
      setTimeout(function () {
        self.go(from);
      }, 0);
      
      return self;
    }
    
    throw new Error('unsupported redirect', arguments);
  }
  
  
  
  /**
   * 
   * AKA Router.exit in page.js
   * 
   * @param {String} path
   * @param {Function} fn
   * @return Router
   */
  Router.prototype.exit = function (path, fn) {
    if (typeof path == 'function') {
      return this.exit('*', path);
    }
    
    var options = {
      base: this.base
    };
  
    var route = new Route(path, options);
    for (var i = 1; i < arguments.length; ++i) {
      this._exits.push(route.middleware(arguments[i]));
    }
    
    return this;
  }
  
  
  /**
   * Use Middleware
   *
   * @param {Function} fn
   * @return {Router}
   */
  Router.prototype.use = function (fn) {
    
    for (var i = 0; i < arguments.length; ++i) {
      this._callbacks.push(arguments[i]);
    }
    
    return this;
  }
  

  /**
   * Define Error Route
   *
   * @param {Number} code Typically a HTTP code
   * @param {Function} fn
   * @return {Router}
   */
  Router.prototype.error = function (code, fn) {
    this._errors[code] = fn;
    return this;
  }


  /**
   * Start
   * 
   * @param {Strin} path
   * @return {Router}
   */
  Router.prototype.start = function (path) {

    path = path || location.pathname + location.search + location.hash;

    this.play();
    
    this.show(path);
    
    return this;
  }
  
  
  /**
   * Pause Router
   * 
   * @return {Router}
   */
  Router.prototype.pause = function () {

    this._running = false;

    removeEventListener('click', this.onclick, false);
    removeEventListener('popstate', this.onpopstate, false);
    
    return this;
  }
  

  /**
   * Play
   *
   * @return {Request}
   */
  Router.prototype.resume = 
  Router.prototype.play = function () {

    var self = this;

    this._running = true;
  
    //  Attach listeners
    window.addEventListener('popstate', function (e) {
      return self.onpopstate(e);
    }, false);
  
    window.addEventListener('click', function (e) {
      return self.onclick(e);
    }, false);
    
    return this;
  }
  
  
  /**
   * Run
   *
   * @param {String} path
   * @return {Router}
   */
  Router.prototype.run = function (path) {
    this.route(path);
    
    return this;
  }


  return Router;

}));
