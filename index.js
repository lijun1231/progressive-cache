/* eslint-disable */
// import model from './model';
// import service from '../service';
let ajax, model;
const md5 = require('js-md5');
const MS_DAY = 86400000; // 一天的毫秒数：24 * 3600 * 1000;
const MS_PERIOD = MS_DAY; // 设置默认有效期

/*
    -- 注释说明：
        创建数据库
*/
class DB {
    constructor (op) {
        this.dbName = op.dbName;
        this.version = op.version;
        this.info = op.info;
        this.size = op.size;
        this.tables = [];
        this.loginFreshOption = op.loginFreshOption;
    }
    init () {
        this.db = openDatabase(this.dbName, this.version, this.info, this.size);
    }
    addTable (op) {
        return new Table(this.db, op);
    }
    dropTable (tbName) {
        return new Promise((resolve, reject) => {
            this.db.transaction(tx => {
                let strSql = `DROP TABLE ${tbName}`;
                tx.executeSql(strSql);
                resolve(strSql);
            })
        });
    }
}
/*
    -- 注释说明：
        tableName: 表名
        params: 传入参数
*/
class Table {
    constructor (db, op) {
        this.tbName = op.tbName;
        this.fields = op.fields;
        this.db = db;
    }
    init () {
        return new Promise(resolve => {
            this.db.transaction(tx => {
                let strSql =  `CREATE TABLE IF NOT EXISTS ${this.tbName} (${this.fields.join(',')})`;
                tx.executeSql(strSql);
                resolve(this);
            });
        });
    }
    instertRow () {
        let {row, op} = arguments[0];
        return new Promise(resolve => {
            this.db.transaction(tx => {
                let strSql;
                let keys = Object.keys(row);
                let vals = keys.map(k => {
                    return `\"${row[k]}\"` || '\"\"';
                });
                if (op.freshType === 'add') {
                    strSql = `INSERT INTO ${this.tbName} (${keys.join(', ')}) VALUES (${vals.join(', ')})`;
                } else {
                    let strTodo = '';
                    keys.map(k => {
                        strTodo += ` ${k}=\"${row[k]}\",`;
                    });
                    strTodo = strTodo.substr(0, strTodo.lastIndexOf(','));
                    strSql = `UPDATE ${this.tbName} SET${strTodo} WHERE cd_key=\"${row.cd_key}\"`;
                }
                tx.executeSql(strSql, [], () => {
                    resolve({
                        status: 0,
                        msg: op.freshType === 'add' ? `新增记录 key:${row.cd_key}` : `更新记录 key:${row.cd_key}`
                    });
                });
            });
        });
    }

    /*
        aim: 查找
        input:
            op(不可空): 查找条件，键值对，如：{cd_name: 'list', cd_key: 'asdf'}
        output: Promise对象，回传查询结果数组
    */
    selectRow (op) {
        return new Promise(resolve => {
            let condition = '';
            Object.keys(op).forEach(v => {
                condition += ` ${v}=\"${op[v]}\" AND`;
            });
            condition = condition.substr(0, condition.lastIndexOf(' AND'));
            this.db.transaction(tx => {
                let strSql = `SELECT * FROM ${this.tbName} WHERE ${condition}`;
                tx.executeSql(strSql, [], (txSel, res) => {
                    resolve(res);
                });
            });
        });
    }

    /*
        aim: 清除记录或清空表
        input:

            (可空): 记录行，若无，则清空整个表，若有，则删除符合该条件的记录
                可传入单个或多个参数，均代表要删除的记录的cd_name
        output: Promise对象，删除状态
    */
    deleteTable (cd_name, vals) {
        let args = arguments;
        return new Promise((resolve, reject) => {
            this.db.transaction(tx => {
                let strSql = `DELETE FROM ${this.tbName}`;
                if (vals.length !== 0) {
                    let fullVals = vals.map(v => {
                        return `${cd_name}="${v}"`;
                    })
                    strSql += ` where ${fullVals.join(" or ")}`;
                }
                tx.executeSql(strSql, [], () => {
                    resolve({
                        status: 0,
                        msg: vals.length !== 0 ? '删除成功' : '清空成功'
                    });
                });
            });
        });
    }
}

// 获取cookie
let getCookie = name => {
    let reg = new RegExp('(^| )' + name + '=([^;]*)(;|$)');
    let arr = document.cookie.match(reg);
    if (arr) {
        return unescape(arr[2]);
    } else {
        return null;
    }
};

module.exports = {
    /*
        aim: 初始化
        input:
            op: 配置参数
                loginFreshOption(可空): 关于数据缓存与登录之间的关系的配置；
                若无，则不做登录刷新缓存的检验；若有，则应包含如下信息：
                    cookieName: 用于对比的cookie
                    storage: 用于存储cookie的对象，支持sessionStorage和localStorage，前者在浏览器关闭时被清理，后者永久存在
                    说明 —— 登录对比机制：每次init也就是说页面加载/刷新的时候，会按照cookieName映射到storage中去查找该值
                        若该值与cookie当前cookie中的值相等，则说明用户已登录，中间未出现过退出登录的情况，则继续按照之前的过期规则使用原缓存
                        若不等，则说明用户可能新登录过，则清理数据缓存
    */
    init (op) {
        ajax = op.ajax; // 传入ajax方法, 该方法接收 name, params两个参数
        model = op.model; // model须包含 staticData和dynamicData两个对象
        // 创建数据库实例
        this.localDb = new DB({
            dbName: 'localDb',
            version: '0.1.0',
            info: 'localDb',
            size: 2 * 1024 * 1024,
            loginFreshOption: op.loginFreshOption || null,
        });

        // 初始化数据库（若无）
        this.localDb.init();

         // 初始化缓存表（若无）
        this.cacheData = this.localDb.addTable({
            // 注意，tbName和fields不要用数据库关键字，比如：update等有特殊含义的单词
            tbName: 'cacheData',
            fields: ['cd_name VARCHAR(20)', 'cd_key VARCHAR(200) unique', 'cd_data TEXT', 'cd_update VARCHAR(50)', 'cd_deadline VARCHAR(50)']
        });

        // 将数据库和表添加全局变量代理，将数据配置项添加给全局变量代理；方便开发测试
        if (window.env === 'dev') {
            window.localDb = this.localDb;
            window.cacheData = this.cacheData;
            window.model = model;
        }

        // 判断登陆过期状态
        let logOp = this.localDb.loginFreshOption;
        if (logOp) {
            let passportName = `_passport_${logOp.cookieName}`;
            let currKeyCookie = getCookie(logOp.cookieName);
            if (logOp.storage[passportName] !== currKeyCookie) {
                this.clearData();
                logOp.storage[passportName] = currKeyCookie;
            }
        }

        // 预加载数据
        if (op.prefetchList) {
            this.prefetchData(op.prefetchList);
        }
    },

    /*
        aim: 添加记录
        input:
            name(非空): table名
            params(非空): 参数
            data(非空): 数据
            interfaceObj(非空): dynamic-data配置项
            freshType(非空): 更新类型：'add'表示新增，'update'表示修改
        output: Promise对象
        state:
            name和data不可空
    */
    setData() {
        let {name, params, bodyText, interfaceObj, freshType} = arguments[0];
        let period = MS_PERIOD; // 默认有效期
        if (interfaceObj) {
            period = interfaceObj.period || period; // 自定义有效期
        }
        return new Promise(resolve => {
            this.cacheData.init().then(r => {
                let key = md5(`${name}${JSON.stringify(this.sortObj(params))}`); // key要保持唯一性，所以需要是localData名和参数结合之后的md5加密值

                // 待执行 插入/更新 操作的数据
                let row = {
                    cd_name: name,
                    cd_key: key,
                    cd_data: escape(bodyText),
                    cd_update: `${Date.now()}`,
                    cd_deadline: `${period + Date.now()}`,
                };

                // 操作选项
                let op = {
                    freshType: freshType // 根据 freshType 来判断，是update一条记录还是insert一条新纪录
                }

                // 执行操作
                this.cacheData.instertRow({row, op}).then(res => {
                    resolve(res);
                });
            });
        });
    },

    /*
        aim: 获取数据表
        input:
            name(非空): table名
            params(可空): 默认为 {}
            option(可空)：配置项，详细如下——
                speCheckTrigger(可空): 一个promise对象，主要用于当发现本地有缓存并且缓存未过期时，用于检测是否需要更新，在 defCheckTrigger （若有）之后
        output: Promise对象
        state:
            会首先从localStorage中找，如果有，则不需要再获取
    */
    getData (name, params, option) {
        params = params || {};

        // 第一级：内存数据 —— staticData
        if (model.staticData[name]) {
            return new Promise(resolve => {
                resolve(model.staticData[name]);
            });
        }

        // 第二级：缓存数据 —— dynamicData
        else if (model.dynamicData[name]) {
            let interfaceObj = model.dynamicData[name];
            let key = md5(`${name}${JSON.stringify(this.sortObj(params))}`);
            return new Promise(resolve => {
                this.cacheData.init().then(tb => {
                    this.cacheData.selectRow({
                        cd_name: name,
                        cd_key: key
                    }).then(resSel => {
                        // 由于cd_keys的唯一性，查出来的dataSel至多有一条记录
                        let dataSel = resSel.rows;
                        // 判断是否需要刷新数据
                        this.getRowStatus(dataSel, option).then(rowSta => {
                            let {shouldFresh, freshType} = rowSta;
                            if (shouldFresh) {
                                return this.fetchData(name, params).then(res => {
                                    // 请求数据
                                    let { body, bodyText } = res;
                                    resolve(body.data);
                                    this.setData({name, params, bodyText, interfaceObj, freshType}).then(res => {
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
        }

        // 第三级：非内存数据，非缓存数据，直接执行ajax
        else {
            return new Promise(resolve => {
                this.fetchData(name, params).then(res => {
                    console.log(res);
                    resolve(res.body.data);
                });
            });
        }
    },

    /*
        aim: 清除数据
        input: -
        output: Promise对象
    */
    clearData () {
        let args = arguments;
        return new Promise (resolve => {
            this.cacheData.deleteTable('cd_name', [...args]).then(res => {
                resolve(res);
            });
        });
    },

    /*
        aim: 预加载数据
        input:
            list(非空): 对象数组
                项目为name和参数组成的键值对 {name: params}
    */
    prefetchData (list) {
        list.forEach(v => {
            this.getData(v.name, v.params || {}, {
                speCheckTrigger: () => {
                    return new Promise(resolve => {
                        resolve(true);
                    });
                }
            })
        })
    },
    /*
        aim: 获取数据
        input:
            name(非空)：接口名（定义的接口代号）
            params(请求参数):
        output: Promise对象
    */
    fetchData (name, params) {
        params = params || {};
        return new Promise(resolve => {
            ajax(name, params).then(res => {
                resolve(res);
            });
        });
    },

    /*
        aim: 获取查询记录集状态，判断是否需要更新表，以及更新方式（新增记录/更新记录）
        input:
            k(不可空): 表示tableName
            option(可空)： getData过来的 option
        output:
            Promise对象，带Object对象参数：
                Object对象，包含如下属性：
                    shouldFresh(必返): 是否需要更新表 (true: 需要, false: 不需要）
                    freshType(当shouldFresh为true时，必返): 更新类型，('add':新增记录,'update':更新记录)
        state: -
    */
    getRowStatus (dataSel, option) {
        let res = {};
        return new Promise(resolve => {
            if (dataSel.length !== 0) {
                let row = dataSel[0];
                // 返回记录行不为空
                if (!this.exceedTime(row)) {
                    // 记录未过期
                    this.checkTrigger(row, option).then(status => {
                        resolve({
                            shouldFresh: status,
                        })
                    });
                } else {
                    // 记录过期
                    resolve({
                        shouldFresh: true,
                        freshType: 'update'
                    });
                }
            } else {
                // 返回记录为空
                resolve({
                    shouldFresh: true,
                    freshType: 'add'
                });
            }
        });
    },

    /*
        aim: 判断记录是否过期
        input:
            row(非空):记录行
        output: true表示记录过期，false 表示记录未过期
    */
    exceedTime (row) {
        if (row.cd_deadline < Date.now()) {
            return true;
        } else {
            return false;
        }
    },

    /*
        aim: 遍历触发器
        input:
            row(非空):记录行
            option(可空):
                speCheckTrigger: 一个返回值为promise的回function
        output: 是否需要更新
            true: 需要更新
            false: 不需要更新
        state:
            触发器：触发器的目的是进一步判断是满足给定条件并决定是否执行数据更新
            若该数据项在dynamic-data中配置了 defCheckTrigger ，则先执行该判断项，若执行结果为true,则直接跳出并更新该记录行
            若执行结果为false,则判断是否有自定义 speCheckTrigger;
    */
    checkTrigger (row, option) {
        let defCheckTrigger = model.dynamicData[row.cd_name].defCheckTrigger;

        return new Promise(resolve => {
            // 判断并执行自定义 speCheckTrigger
            let speCheck = (status) => {
                if (option && option.speCheckTrigger) {
                    option.speCheckTrigger().then(status => {
                        resolve(status)
                    });
                } else {
                    resolve(status);
                }
            }

            // 如果有固定trigger，则先执行该trigger检验
            if (defCheckTrigger) {
                defCheckTrigger().then(status => {
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

    /*
        aim: 对象排序
        input:
            obj(非空): 待排序的对象
        output: 排序后的对象
        state: 排序按obj的键名
    */
    sortObj (obj) {
        let newObj = {};
        Object.keys(obj).sort().forEach(k => {
            newObj[k] = obj[k];
        });
        return newObj;
    },
}
