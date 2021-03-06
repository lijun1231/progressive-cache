| update | state | tips |
|-|-|-|
| 2017年07月24日 | 修复可用性 | 当不支持websql的时候，依然可用 |
| 2017年07月24日 | babel-preset-stage-2 | 增加开发环境实时编译，保证publish es5语法 |
| 2018年04月04日 | 增加opt参数 |用于增强接口定制性，业务调用中传过来的参数会原封不动的透传给ajax方法|
开发
===
```javascript
npm install babel-cli // 工具依赖
yarn // 安装所需工具
npm run watch // 实时编译
```

示意图：
====
####
![image](https://github.com/lijun1231/progressive-cache/blob/master/images/explanation.png)

使用方法：
====
通常，咱们的项目中，会有一个接口名和接口地址对应表 interface.js
--
```javascript
export default {
    getDetail: ['/web/getDetail', 'get', op => {
        return op;
    }],
    getList: ['/web/getList'],
    getContent: '/web/getContent',
};
```

安装
--
``` javascript
npm install progressive-cache
yarn add progressive-cache
```

初始化 —— 你可以在任何地方init，比如：在DOMContentLoaded之后：
--
```javascript
import dataController from 'progressive-cache'; // 引入node_module包
import model from 'xx/model'; // 你自己的配置表文件
dataController.init({
    size: 10, // 单位MB，表示给定容量，默认为5MB
    ajax: /* 您自己的ajax方法 */, // 传入ajax方法, 该方法接收 name, params两个参数
    model: model, // model须包含 staticData和dynamicData两个对象
    // 如果您想要在新用户登录的时候，清理掉原用户的数据
    loginFreshOption: {
        cookieName: 'yourCookieName', // 用户登录唯一标识
        storage: window.sessionStorage // 用户登录唯一标识存储的位置，如果为sessionStorage，则浏览器关闭之后，也会清理数据，如果为localStorage，则不会
    },

    // 如果您需要在初始化的时候，预加载一些数据
    prefetchList: [{
            name: 'getList',
        }, {
            name: 'getDetail',
            params: { a: 1, b: 2 }, // 还可以传递参数
        }
    ]
});
```

缓存配置表：
--
```javascript
// model.js
import staticData from './static-data';
import dynamicData from './dynamic-data';
export default {
    staticData: staticData,
    dynamicData: dynamicData,
}
// static-data.js：
export default {
    getContent: [{a: 1, b: 2}],
}
// dynamic-data.js：
const MS_DAY = 86400000; // 天小时的毫秒数：24 * 3600 * 1000;
export default {
    getList: {},
    getDetail: {
        period: MS_DAY, // 有效期
        defCheckTrigger() {
            return new Promise((resolve) => {
                // ----代码块 xxxx
                resolve(false); // 传入true 的时候，会触发更新，传入false 的时候，则不会触发更新
            });
        },
    },
    getAuthContents: {
        period: MS_DAY,
    },
    getContent: {
        period: MS_DAY
    }
}
```

除了初始化预加载数据，你还可以随时随地预加载数据：
--
```javascript
dataController.prefetchData([{
    name: 'getDetail',
    params: { a: 1, b: 2 }
}, {
    name: 'xxx',
    params: {}
}]);
```

获取数据
--
``` javascript
// 只需要传入interface.js中定义的接口名和参数即可
// 参数不分先后，比如{a: 1, b: 2} 与{b: 2, a: 1} 在缓存是否存在的对比过程中，会被认为是相同的参数
// 你不用担心缓存配置表中没有配置就无法正常ajax，如果缓存配置表中没有配置，则会正常的ajax，所以全站都可以使用getData来请求数据
dataController.getData('getDetail', { a: 1 , b: 2 }, {
}).then(data => {
    console.log(data); // data是Response.body.data中的值
});

// 如果还不满足，你在业务中还需要根据当时的场景和状态进行额外的判定触发更新缓存，可以speCheckTrigger参数作为自定义触发器
dataController.getData('getDetail', { a: 1 , b: 2 }, {
    // 自定义触发器
    speCheckTrigger: () => {
        return new Promise(resolve => {
            if (this.filterObj.ok)
            resolve(false); // 当resolve(true)时更新数据
        });
    }
}).then(data => {
    console.log(data);
});

// 在执行request请求的时候，除了请求参数之外
// 可能还需要按需透传一些配置项，用于自己的业务中进行一些特殊处理
dataController.getData('getDetail', { a: 1, b: 2 }, {
    // 自定义触发器
    opt: {
        origin: 'http://xxx.com',
    }
}).then(data => {
    console.log(data);
});
// 透传参数给 request 请求获取到这个opt了

```
数据清理
--
``` javascript
dataController.clearData(): // 清理所有缓存数据
dataController.clearData(['getDetail', 'xxx']): // 清理指定缓存数据
```
