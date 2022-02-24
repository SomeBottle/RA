/*视图部分*/
'use strict';
var s = (selector, all = false) => all ? document.querySelectorAll(selector) : document.querySelector(selector);/*简化一下选择器*/
/*在字符串原型链上加个寻找模板占位符的方法*/
String.prototype.findTp = function () {
    return this.matchAll(new RegExp('\\{\\[(\\S*?)\\]\\}', 'gi'));/*使用?非贪心模式，防止没有空格的整段被匹配，利用matchAll识别正则分组*/
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

const applyStyle = (elemArr, styleObj) => { // 批量应用样式
    elemArr = Array.isArray(elemArr) ? elemArr : [elemArr]; // 支持单一元素
    elemArr.forEach(elem => {
        if (elem instanceof Element) {
            for (let key in styleObj) elem.style[key] = styleObj[key]; // 应用样式
        }
    });
}

const basicView = { // 基础视图
    langList: {},
    currentLang: {},
    originalTemplates: '',
    prevCSVInput: '', // 储存输入的CSV，和nameInputChecker搭配
    modifyingCSV: false, // 是不是正在编辑CSV，和nameInputChecker搭配
    loadedPages: {},
    noticeTimer: null, // 通知相关定时器
    timerForReset: null, // 清空输入框相关定时器
    getLang: function (langStr) {
        /* 根据指示获取当前语言对应的文本，传入的字符串类似：'notice>relation.nameRequired' */
        let keyLayer = langStr.split('>').filter(x => x.notEmpty()).map(x => x.trim()),
            langPointer = this.currentLang;
        for (let i = 0, len = keyLayer.length; i < len; i++) {
            let objKey = keyLayer[i];
            if (langPointer[objKey]) { // 如果指针代表的对象属性存在
                langPointer = langPointer[objKey]; // 指针后移
            } else {
                return keyLayer.pop(); // 如果找不到就返回最后一个key
            }
        }
        return langPointer; // 最后没出错的话指针会指向一个字符串
    },
    motionChecker: function (element, func, checkAnim = false) { /* CSS3运动结束监听回调器(监听元素,回调函数,监听的是不是css3Animation) */
        let chosenTester = '', testers = checkAnim ? {
            'animation': 'animationend',
            'OAnimation': 'oAnimationEnd',
            'MozAnimation': 'animationend',
            'WebkitAnimation': 'webkitAnimationEnd'
        } : {
            'transition': 'transitionend',
            'OTransition': 'oTransitionEnd',
            'MozTransition': 'transitionend',
            'WebkitTransition': 'webkitTransitionEnd'
        };
        for (var i in testers) {
            if (element.style[i] !== undefined) {
                chosenTester = testers[i];
            }
        }
        function callBack() {
            element.removeEventListener(chosenTester, callBack);
            func();
        }
        element.addEventListener(chosenTester, callBack);
    },
    closeNotice: function () {
        let noticer = s('.notice');
        noticer.style.transform = 'translateY(-100%)';
        basicView.motionChecker(noticer, () => {
            s('.notice span').style.float = 'initial';
            s('.notice a').style.display = 'none';
        })
    },
    notice: function (content, needConfirm = false) { /*弹出提示(提示内容,是否要用户确认)*/
        let noticer = s('.notice'), bv = this;
        noticer.style.transform = 'translateY(0)';
        s('.notice span').innerHTML = content;
        if (needConfirm) {
            s('.notice span').style.float = 'left';
            s('.notice a').style.display = 'block';
        } else {
            clearInterval(bv.noticeTimer);
            bv.noticeTimer = setTimeout(bv.closeNotice, 1500);
        }
    },
    langRender: function (section, html) {
        let bv = this, langOBJ = bv.currentLang;
        /*获得选择的语言对应的配置文件*/
        /*找出所有的替换符号*/
        let matches = html.findTp(), viewLang = langOBJ[section];
        for (let single of matches) {
            /*如果在语言配置文件中有对应翻译，就替换上，反之就是缺失翻译，保留类似menu.howToUse的占位字串*/
            let theHolder = single[1];
            html = html.replaceTp(theHolder, viewLang[theHolder] || theHolder);
        }
        /*返回重渲染翻译后html*/
        return html;
    },
    fHook: function (resp) {/*用于判断fetch状态码的一个hook*/
        if (resp.status == 200) {
            return resp;
        } else {
            throw 'Error response, code:' + resp.status;
        }
    },
    nameInputChecker: () => { // 检查输入的关系名是否已经存在，存在就做出相关操作
        let bv = basicView,
            csvInput = s('#csvForm'),
            inputElem = s('#relationName'),
            relaName = inputElem.value,
            relation = relations.relationBase[relaName];
        if (relation) {
            // 在输入存在的表单后自动还原成CSV格式
            // 先还原成表格数组
            let tableArr = [relation['attrs']].concat(relation['tuples']);
            bv.modifyingCSV = true;
            csvInput.value = relations.toCsv(tableArr);
            s('.add').innerHTML = bv.getLang('basicView > relation.modify'); // 更改按钮文字为编辑
        } else if (bv.modifyingCSV) { // 之前刚刚编辑过表单，现在没有编辑了而是新增
            bv.modifyingCSV = false;
            s('.add').innerHTML = bv.getLang('basicView > relation.add'); // 更改按钮文字为添加
            csvInput.value = bv.prevCSVInput; // 还原之前输入的内容
        } else {
            bv.prevCSVInput = csvInput.value; // 记录csv输入内容
        }
    },
    init: function () {
        /*最先拉取语言*/
        let bv = this;
        fetch('./langs/index.json')
            .then((resp) => bv.fHook(resp).json())
            .then((resp) => {
                localStorage.RAchosenLang = localStorage.RAchosenLang || resp.defaultLang;
                /*载入语言列表*/
                bv.langList = resp.langList;
                /*选定语言*/
                let chosenLang = localStorage.RAchosenLang;
                console.log('Choose Language:' + bv.langList[chosenLang]);
                return fetch('./langs/' + chosenLang + '.json');
            })
            .then((langResp) => bv.fHook(langResp).json())
            .catch(error => {
                bv.notice('Language config load failed!', true);
                throw error;
            })
            .then((langResp) => {
                let basicView = s('.basicView'), basicViewTemplate = bv.originalTemplates || basicView.innerHTML;
                bv.currentLang = langResp;
                /*储存本来的容器模板，以后还有用*/
                bv.originalTemplates = basicViewTemplate;
                basicView.innerHTML = bv.langRender('basicView', basicViewTemplate);
                basicView.style.opacity = 1;
                /*初始化菜单，使点击事件与浮页关联*/
                let menuLinks = s('.menu a', true),
                    formInput = s('.formInput');
                for (let i in menuLinks) {
                    let e = menuLinks[i], attr = (typeof e == 'object' ? e.getAttribute('data-src') : null);
                    if (attr) e.addEventListener('click', () => bv.float(attr), false);
                }
                s('#relationName').addEventListener('input', bv.nameInputChecker, false); // 在关系名输入框加上监听器
                formInput.onmousedown = bv.startClear.bind(bv); // 长按csv输入框清空
                formInput.ontouchstart = bv.startClear.bind(bv); // 适应移动端
            })
    },
    startClear: function () { // 开始准备清除输入框
        let bv = this,
            waitBar = s('.formInput .waitBar'), // 清除进度条
            csvInput = s('#csvForm'), // csv输入框
            nameInput = s('#relationName'); // 关系名输入框
        applyStyle(waitBar, {
            'width': '100%',
            'height': '100%',
            'border-radius': '0'
        });
        clearTimeout(bv.timerForReset); // 清除先前的计时器，防止重复
        bv.timerForReset = setTimeout(() => {
            csvInput.value = '';
            nameInput.value = ''; // 清空输入框
            bv.abortClear(); // 调用一次取消清除函数来让进度条返回初始状态
            bv.nameInputChecker(); // 重设按钮文本
        }, 1000);
        function abort() {
            window.removeEventListener('mouseup', abort, false);
            window.removeEventListener('touchend', abort, false); // 移除事件
            window.removeEventListener('mousemove', abort, false);
            window.removeEventListener('touchmove', abort, false);
            bv.abortClear();
        }
        window.addEventListener('mouseup', abort, false); // 在鼠标抬起时取消清除
        window.addEventListener('touchend', abort, false); // 适应移动端
        window.addEventListener('mousemove', abort, false); // 鼠标移动就取消清除（这样可以划选内容）
        window.addEventListener('touchmove', abort, false); // 适应移动端
    },
    abortClear: function () { // 取消/停止清除
        let bv = this,
            waitBar = s('.formInput .waitBar');
        clearTimeout(bv.timerForReset); // 清除计时器
        applyStyle(waitBar, {
            'width': '0%',
            'height': '0%',
            'border-radius': '2em'
        });
    },
    float: async function (page, funcOnResp = false) {/*(要载入的页面,对请求返回的html内容进行处理的函数)*/
        let fl = s('.floatLayer'),
            fc = s('.floatContent'),
            bv = this,
            loaded = bv.loadedPages[page],
            localPage = Promise.resolve(loaded),
            applyPage = await (loaded ? localPage : fetch('./pages/' + page + '.html')
                .then((resp) => bv.fHook(resp).text()).catch(e => {
                    bv.notice(bv.getLang('notice > page.loadFailed'), true);
                    funcOnResp = null;
                    throw e;
                })
            );
        bv.loadedPages[page] = applyPage;
        fc.innerHTML = funcOnResp ? funcOnResp(applyPage) : applyPage;
        applyStyle(fl, {
            'z-index': 50,
            'opacity': 1
        });
        funcOnResp = null;
    },
    closeFloat: function () {
        let fl = s('.floatLayer'), bv = this;
        fl.style.opacity = 0;
        bv.motionChecker(fl, () => {
            fl.style.zIndex = -1;
        });
    }
};

const relationView = { // 关系表相关的视图
    relaTemplate: '',
    all: function () {/*查看所有的表*/
        let bv = basicView,
            rv = this,
            nameInput = s('#relationName'); // 关系名输入框
        basicView.float("relationThumb", (resp) => {
            let template = resp, // relationThumb.html是模板
                relas = relations.relationBase, // 临时引用关系集
                rendered = ''; // 渲染后的html
            for (let i in relas) { // 遍历关系表集
                let temp = template.replaceTp('relationName', i); // 替换模板中的关系名
                temp = temp.replaceTp('attributes', relas[i]['attrs'].join(','));  // 替换模板中的属性列
                rendered += bv.langRender("relationView", temp); // 添加到渲染后的html
            }
            return rendered || `<p>${bv.getLang('relationView > relation.noItem')}</p>`;
        }).then(res => {
            let thumbFoots = s('.singleThumb > .foot', true);
            for (let foot of thumbFoots) { // 关系表缩略底部按钮
                let name = foot.getAttribute('data-name'), // 获得关系名
                    csvBtn = foot.querySelector('.csvBtn'), // 获得csv按钮
                    delBtn = foot.querySelector('.delBtn'); // 获得删除按钮
                csvBtn.addEventListener('click', () => {
                    bv.closeFloat();
                    nameInput.value = name; // 填充关系名
                    bv.nameInputChecker(); // 触发编辑
                }, false); // 绑定csv按钮点击事件
                delBtn.addEventListener('click', () => {
                    if (confirm(bv.getLang('relationView > relation.delConfirm'))) {
                        relations.del(name); // 删除关系表
                        rv.all(); // 重新渲染
                    }
                }, false); // 绑定删除按钮点击事件
            }
        });
    },
    float: function (html) {
        let tl = s('.relationLayer'), tc = s('.relationContent');
        tc.innerHTML = html;
        applyStyle(tl, {
            'z-index': 52,
            'opacity': 1
        });
    },
    closeFloat: function () {
        let tl = s('.relationLayer');
        tl.style.opacity = 0;
        basicView.motionChecker(tl, () => {
            tl.style.zIndex = -1;
        });
    },
    modify: async function () {
        let rv = this,
            bv = basicView,
            localTp = rv.relaTemplate,
            rsTp = Promise.resolve(localTp),
            tHtml = await (localTp ? rsTp : fetch("./pages/relationModify.html")
                .then(resp => bv.fHook(resp).text()).catch((e) => {
                    bv.notice(bv.getLang('notice > relation.modifyPageLoadFailed'), true);
                    throw e;
                })
            );
        rv.relaTemplate = tHtml;
        rv.float(tHtml);
    },
    addRela: function () { // 添加关系表
        let bv = basicView,
            csvInput = s('#csvForm'),
            csvContent = csvInput.value,
            nameInput = s('#relationName'),
            name = nameInput.value.trim(), // 获得关系表名
            parsed = relations.parseCsv(csvContent); // 解析CSV为数组
        if (name.notEmpty()) {
            relations.write(name, parsed).then(res => {
                csvInput.value = '';
                nameInput.value = ''; // 提交后清空表单
                bv.prevCSVInput = ''; // 提交后清空之前的CSV输入
                bv.notice(bv.getLang('notice > ' + res));
                bv.nameInputChecker(); // 检查应用按钮文字
            }, rej => {
                bv.notice(bv.getLang('notice > ' + rej));
            });
        } else {
            bv.notice(bv.getLang('notice > relation.nameRequired'));
        }
    }
};
/*For temporary test*/
relationView.modify();