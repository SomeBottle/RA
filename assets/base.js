/*基础依赖*/
'use strict';
var s = (selector, all = false) => all ? document.querySelectorAll(selector) : document.querySelector(selector);/*简化一下选择器*/

const zip = function () { // 模仿一下Python的zip函数
    let args = Array.from(arguments);
    return args.length > 0 ? args.reduce((prev, curr, currInd) => {
        return prev.map((v, i) => {
            if (currInd === 1) v = [v];
            v.push(curr[i]);
            return v;
        })
    }) : [];
}, applyStyle = (elemArr, styleObj, delay = false) => { // 批量应用样式(元素/元素数组,样式对象,应用延迟)
    elemArr = Array.isArray(elemArr) ? elemArr : [elemArr]; // 支持单一元素
    let apply = () => {
        elemArr.forEach(elem => {
            if (elem instanceof Element) {
                for (let key in styleObj) elem.style[key] = styleObj[key]; // 应用样式
            }
        });
    };
    if (delay) { // 延迟应用样式
        setTimeout(apply, delay);
    } else {
        apply();
    }
}, isStr = function (strArr) { // 判断一个或多个值是不是字符串
    strArr = Array.isArray(strArr) ? strArr : [strArr];
    for (let i = 0, len = strArr.length; i < len; i++) {
        if (typeof strArr[i] !== 'string') return false;
    }
    return true;
}, isAllObj = function (arr) { // 判断一个或多个值是不是数组
    for (let i = 0, len = arr.length; i < len; i++) {
        if (!(arr[i] instanceof Object)) return false;
    }
    return true;
}, extStr = function (strArr) {// 将字符串由'str'提取为str
    strArr = Array.isArray(strArr) ? strArr : [strArr];
    for (let i = 0, len = strArr.length; i < len; i++) {
        let matching = strArr[i].match(/^'(.+?)'$/);
        if (matching) strArr[i] = matching[1];
    }
    return strArr;
}
/*在字符串原型链上加个寻找模板占位符的方法*/
String.prototype.findTp = function () {
    return this.matchAll(/\{\[(\S*?)\]\}/gi);/*使用?非贪心模式，防止没有空格的整段被匹配，利用matchAll识别正则分组*/
}
String.prototype.extractTp = function (flag, remove = false) { // 提取模板(占位符,是否移除HTML)，返回[提取出的模板,原模板内容(可选去除提取的部分)]
    let splitOnce = this.split(new RegExp('\\{\\{' + flag + '\\}\\}', 'gi')),
        template = remove ? this.replace(new RegExp('\\{\\{' + flag + '\\}\\}[\\s\\S]*?\\{\\{' + flag + 'End\\}\\}', 'gi'), '') : this;
    if (splitOnce[1]) {
        let extracted = splitOnce[1].split(new RegExp('\\{\\{' + flag + 'End\\}\\}', 'gi'))[0];
        return [extracted, template];
    } else {
        return false;
    }
}
/*在字符串原型链上加个替换模板占位符的方法*/
String.prototype.replaceTp = function (from, to) {
    return this.replace(new RegExp('\\{\\[' + from + '\\]\\}', 'gi'), to);
}
/*在字符串原型链上加一个判断是否不为空的方法*/
String.prototype.notEmpty = function () {
    let str = this;
    return str && !str.match(/^\s*$/);
}