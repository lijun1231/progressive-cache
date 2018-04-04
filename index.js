'use strict';

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var ajax = void 0,
    model = void 0;
var md5 = require('js-md5');
var MS_DAY = 86400000;
var MS_PERIOD = MS_DAY;
var surportDb = window.openDatabase ? true : false;

var DB = function () {
    function DB(op) {
        (0, _classCallCheck3.default)(this, DB);

        this.dbName = op.dbName;
        this.version = op.version;
        this.info = op.info;
        this.size = op.size;
        this.tables = [];
        this.loginFreshOption = op.loginFreshOption;
    }

    (0, _createClass3.default)(DB, [{
        key: 'init',
        value: function init() {
            this.db = openDatabase(this.dbName, this.version, this.info, this.size);
        }
    }, {
        key: 'addTable',
        value: function addTable(op) {
            return new Table(this.db, op);
        }
    }, {
        key: 'dropTable',
        value: function dropTable(tbName) {
            var _this = this;

            return new _promise2.default(function (resolve, reject) {
                _this.db.transaction(function (tx) {
                    var strSql = 'DROP TABLE ' + tbName;
                    tx.executeSql(strSql);
                    resolve(strSql);
                });
            });
        }
    }]);
    return DB;
}();

var Table = function () {
    function Table(db, op) {
        (0, _classCallCheck3.default)(this, Table);

        this.tbName = op.tbName;
        this.fields = op.fields;
        this.db = db;
    }

    (0, _createClass3.default)(Table, [{
        key: 'init',
        value: function init() {
            var _this2 = this;

            return new _promise2.default(function (resolve) {
                _this2.db.transaction(function (tx) {
                    var strSql = 'CREATE TABLE IF NOT EXISTS ' + _this2.tbName + ' (' + _this2.fields.join(',') + ')';
                    tx.executeSql(strSql);
                    resolve(_this2);
                });
            });
        }
    }, {
        key: 'instertRow',
        value: function instertRow() {
            var _this3 = this;

            var _arguments$ = arguments[0],
                row = _arguments$.row,
                op = _arguments$.op;

            return new _promise2.default(function (resolve) {
                _this3.db.transaction(function (tx) {
                    var strSql = void 0;
                    var keys = (0, _keys2.default)(row);
                    var vals = keys.map(function (k) {
                        return '"' + row[k] + '"' || '\"\"';
                    });
                    if (op.freshType === 'add') {
                        strSql = 'INSERT INTO ' + _this3.tbName + ' (' + keys.join(', ') + ') VALUES (' + vals.join(', ') + ')';
                    } else {
                        var strTodo = '';
                        keys.map(function (k) {
                            strTodo += ' ' + k + '="' + row[k] + '",';
                        });
                        strTodo = strTodo.substr(0, strTodo.lastIndexOf(','));
                        strSql = 'UPDATE ' + _this3.tbName + ' SET' + strTodo + ' WHERE cd_key="' + row.cd_key + '"';
                    }
                    tx.executeSql(strSql, [], function () {
                        resolve({
                            status: 0,
                            msg: op.freshType === 'add' ? '\u65B0\u589E\u8BB0\u5F55 key:' + row.cd_key : '\u66F4\u65B0\u8BB0\u5F55 key:' + row.cd_key
                        });
                    });
                });
            });
        }
    }, {
        key: 'selectRow',
        value: function selectRow(op) {
            var _this4 = this;

            return new _promise2.default(function (resolve) {
                var condition = '';
                (0, _keys2.default)(op).forEach(function (v) {
                    condition += ' ' + v + '="' + op[v] + '" AND';
                });
                condition = condition.substr(0, condition.lastIndexOf(' AND'));
                _this4.db.transaction(function (tx) {
                    var strSql = 'SELECT * FROM ' + _this4.tbName + ' WHERE ' + condition;
                    tx.executeSql(strSql, [], function (txSel, res) {
                        resolve(res);
                    });
                });
            });
        }
    }, {
        key: 'deleteTable',
        value: function deleteTable(cd_name, vals) {
            var _this5 = this;

            var args = arguments;
            return new _promise2.default(function (resolve, reject) {
                _this5.db.transaction(function (tx) {
                    var strSql = 'DELETE FROM ' + _this5.tbName;
                    if (vals.length !== 0) {
                        var fullVals = vals.map(function (v) {
                            return cd_name + '="' + v + '"';
                        });
                        strSql += ' where ' + fullVals.join(" or ");
                    }
                    tx.executeSql(strSql, [], function () {
                        resolve({
                            status: 0,
                            msg: vals.length !== 0 ? '删除成功' : '清空成功'
                        });
                    });
                });
            });
        }
    }]);
    return Table;
}();

var getCookie = function getCookie(name) {
    var reg = new RegExp('(^| )' + name + '=([^;]*)(;|$)');
    var arr = document.cookie.match(reg);
    if (arr) {
        return unescape(arr[2]);
    } else {
        return null;
    }
};

module.exports = {
    init: function init(op) {
        ajax = op.ajax;
        model = op.model;
        if (!surportDb) return;

        this.localDb = new DB({
            dbName: 'localDb',
            version: '0.1.0',
            info: 'localDb',
            size: (op.size || 5) * 1024 * 1024,
            loginFreshOption: op.loginFreshOption || null
        });

        this.localDb.init();

        this.cacheData = this.localDb.addTable({
            tbName: 'cacheData',
            fields: ['cd_name VARCHAR(20)', 'cd_key VARCHAR(200) unique', 'cd_data TEXT', 'cd_update VARCHAR(50)', 'cd_deadline VARCHAR(50)']
        });

        if (window.env === 'dev') {
            window.localDb = this.localDb;
            window.cacheData = this.cacheData;
            window.model = model;
        }

        var logOp = this.localDb.loginFreshOption;
        if (logOp) {
            var passportName = '_passport_' + logOp.cookieName;
            var currKeyCookie = getCookie(logOp.cookieName);
            if (logOp.storage[passportName] !== currKeyCookie) {
                this.clearData();
                logOp.storage[passportName] = currKeyCookie;
            }
        }

        if (op.prefetchList) {
            this.prefetchData(op.prefetchList);
        }
    },
    setData: function setData() {
        var _this6 = this;

        var _arguments$2 = arguments[0],
            name = _arguments$2.name,
            params = _arguments$2.params,
            bodyText = _arguments$2.bodyText,
            interfaceObj = _arguments$2.interfaceObj,
            freshType = _arguments$2.freshType;

        var period = MS_PERIOD;
        if (interfaceObj) {
            period = interfaceObj.period || period;
        }
        return new _promise2.default(function (resolve) {
            _this6.cacheData.init().then(function (r) {
                var key = md5('' + name + (0, _stringify2.default)(_this6.sortObj(params)));
                var row = {
                    cd_name: name,
                    cd_key: key,
                    cd_data: escape(bodyText),
                    cd_update: '' + Date.now(),
                    cd_deadline: '' + (period + Date.now())
                };

                var op = {
                    freshType: freshType };

                _this6.cacheData.instertRow({ row: row, op: op }).then(function (res) {
                    resolve(res);
                });
            });
        });
    },
    getData: function getData(name, params, option) {
        var _this7 = this;

        params = params || {};

        if (model.staticData[name]) {
            return new _promise2.default(function (resolve) {
                resolve(model.staticData[name]);
            });
        } else if (surportDb && model.dynamicData[name]) {
                var interfaceObj = model.dynamicData[name];
                var key = md5('' + name + (0, _stringify2.default)(this.sortObj(params)));
                return new _promise2.default(function (resolve) {
                    _this7.cacheData.init().then(function (tb) {
                        _this7.cacheData.selectRow({
                            cd_name: name,
                            cd_key: key
                        }).then(function (resSel) {
                            var dataSel = resSel.rows;

                            _this7.getRowStatus(dataSel, option).then(function (rowSta) {
                                var shouldFresh = rowSta.shouldFresh,
                                    freshType = rowSta.freshType;

                                if (shouldFresh) {
                                    return _this7.fetchData(name, params, option && option.opt).then(function (res) {
                                        var body = res.body,
                                            bodyText = res.bodyText;

                                        resolve(body.data);
                                        _this7.setData({ name: name, params: params, bodyText: bodyText, interfaceObj: interfaceObj, freshType: freshType }).then(function (res) {
                                            if (res.status !== 0) {
                                                throw res.msg;
                                            }
                                        });
                                    });
                                } else {
                                    resolve(JSON.parse(unescape(dataSel[0].cd_data)).data);
                                }
                            });
                        });
                    });
                });
            } else {
                    return new _promise2.default(function (resolve, reject) {
                        _this7.fetchData(name, params, option && option.opt).then(function (res) {
                            resolve(res.body.data);
                        }).catch(function (res) {
                            reject(res && res.body && res.body.data || {});
                        });
                    });
                }
    },
    clearData: function clearData() {
        var _this8 = this;

        var args = arguments;
        return new _promise2.default(function (resolve) {
            _this8.cacheData.deleteTable('cd_name', [].concat((0, _toConsumableArray3.default)(args))).then(function (res) {
                resolve(res);
            });
        });
    },
    prefetchData: function prefetchData(list) {
        var _this9 = this;

        list.forEach(function (v) {
            _this9.getData(v.name, v.params || {}, {
                speCheckTrigger: function speCheckTrigger() {
                    return new _promise2.default(function (resolve) {
                        resolve(true);
                    });
                }
            });
        });
    },
    fetchData: function fetchData(name, params, opt) {
        params = params || {};
        return new _promise2.default(function (resolve, reject) {
            ajax(name, params, opt).then(function (res) {
                resolve(res);
            }).catch(function (res) {
                reject(res);
            });
        });
    },
    getRowStatus: function getRowStatus(dataSel, option) {
        var _this10 = this;

        var res = {};
        return new _promise2.default(function (resolve) {
            if (dataSel.length !== 0) {
                var row = dataSel[0];

                if (!_this10.exceedTime(row)) {
                    _this10.checkTrigger(row, option).then(function (status) {
                        resolve({
                            shouldFresh: status
                        });
                    });
                } else {
                    resolve({
                        shouldFresh: true,
                        freshType: 'update'
                    });
                }
            } else {
                resolve({
                    shouldFresh: true,
                    freshType: 'add'
                });
            }
        });
    },
    exceedTime: function exceedTime(row) {
        if (row.cd_deadline < Date.now()) {
            return true;
        } else {
            return false;
        }
    },
    checkTrigger: function checkTrigger(row, option) {
        var defCheckTrigger = model.dynamicData[row.cd_name].defCheckTrigger;

        return new _promise2.default(function (resolve) {
            var speCheck = function speCheck(status) {
                if (option && option.speCheckTrigger) {
                    option.speCheckTrigger().then(function (status) {
                        resolve(status);
                    });
                } else {
                    resolve(status);
                }
            };

            if (defCheckTrigger) {
                defCheckTrigger().then(function (status) {
                    if (status) {
                        resolve(status);
                    } else {
                        speCheck(status);
                    }
                });
            } else {
                speCheck(false);
            }
        });
    },
    sortObj: function sortObj(obj) {
        var newObj = {};
        (0, _keys2.default)(obj).sort().forEach(function (k) {
            newObj[k] = obj[k];
        });
        return newObj;
    }
};
