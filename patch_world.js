(function() {
    let shared_state = new Map(Object.entries({safe_windows: new WeakMap(), functions_to_hide: new WeakMap(), functions_to_hide_rev: new WeakMap(), strings_to_hide: [], hidden_globals: [], init: false}));

    let invisible_define = function(obj, key, value) {
        shared_state.get('hidden_globals').push(key);
        Object.defineProperty(obj, key, {
            enumberable: false,
            configurable: false,
            writable: true,
            value: value
        });
    };

    const master_key = 'ttap#4547';
    if (!top[master_key]) {
        invisible_define(top, master_key, shared_state);
    } else {
        shared_state = top[master_key];
    }

    let _window = shared_state.get('safe_windows').get(window);

    let conceal_function = function(original_Function, hook_Function) {
        shared_state.get('functions_to_hide').set(hook_Function, original_Function);
        shared_state.get('functions_to_hide_rev').set(original_Function, hook_Function);
    };

    const keys_to_ignore = ['call', 'apply', 'bind'];
    function analyse(parent, keys, descriptors) {
        try {
            const last_key = keys[keys.length - 1];
            let obj = parent[last_key];
            if (descriptors.get(obj) || obj == null || new Set(keys).size !== keys.length) {
                return descriptors;
            }

            if (typeof obj === 'function' || typeof obj === 'object') {
                descriptors.set(obj, {
                    parent: parent,
                    key: last_key,
                    valid: typeof obj === 'function' && !keys_to_ignore.includes(last_key) && (keys.length <= 2 || keys[keys.length-2] === 'prototype')
                });

                Reflect.ownKeys(obj).forEach(function(_key) {
                    let descriptor = Object.getOwnPropertyDescriptor(obj, _key);
                    if (descriptor.get == null && descriptor.set == null) {
                        keys.push(_key);
                        analyse(obj, keys, descriptors);
                        keys.pop();
                    }
                });
            }
        } catch (e) {}

        return descriptors;
    }

    function replace_enumerables(obj, seen) {
        if (obj == null || seen.includes(obj)) {
            return;
        }

        _window.Object.keys(obj).forEach(function(key) {
            obj[key] = shared_state.get('functions_to_hide').get(obj[key]) || obj[key];
            seen.push(obj[key]);
            replace_enumerables(obj[key], seen);
            seen.pop();
        });
    }
    analyse(window, ['window'], new Map()).forEach(function(descriptor, _fn, map) {
        let original = descriptor.parent[descriptor.key];
        let is_hook = shared_state.get('functions_to_hide').get(original);
        let hook = shared_state.get('functions_to_hide_rev').get(original);
        if (is_hook || !descriptor.valid) {
            // pass
        } else if (hook) {
            descriptor.parent[descriptor.key] = hook;
        } else {
            hook = new Proxy(original, {
                apply: function(target, _this, _arguments) {
                    _this = shared_state.get('functions_to_hide').get(_this) || _this;    
                    target = shared_state.get('functions_to_hide').get(target) || target;    
                    replace_enumerables(_arguments, new _window.Array());

                    try {
                        var ret = _window.Function.prototype.apply.apply(target, [_this, _arguments]);
                    } catch (e) {
                        e.stack = _window.String.prototype.replace.apply(e.stack, [/\n.*Object\.apply.*/, '']);
                        throw e;
                    }

                    return ret;
                }
            });

            descriptor.parent[descriptor.key] = hook;
            conceal_function(original, hook);
        }

    });
})()
