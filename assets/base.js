/*基础依赖*/
'use strict';
var s = (selector, all = false) => all ? document.querySelectorAll(selector) : document.querySelector(selector);/*简化一下选择器*/

const zip = function () { // 模仿一下Python的zip函数
    let args = Array.from(arguments);
    return args.length > 0 ? args.reduce((prev, curr) => {
        return prev.map((v, i) => {
            if (!(v instanceof Array)) v = [v];
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