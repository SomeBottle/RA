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

const basicView = { // 基础视图
    langList: {},
    currentLang: {},
    originalTemplates: '',
    loadedPages: {},
    noticeTimer: null,
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
        let noticer = s('.notice'), that = this;
        noticer.style.transform = 'translateY(0)';
        s('.notice span').innerHTML = content;
        if (needConfirm) {
            s('.notice span').style.float = 'left';
            s('.notice a').style.display = 'block';
        } else {
            clearInterval(that.noticeTimer);
            that.noticeTimer = setTimeout(that.closeNotice, 2000);
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
    inputExistChecker: (e) => { // e既可以是直接传入元素，亦可以是Event对象
        let bv = basicView,
            inputElem = e instanceof Element ? e : e.target,
            relaName = inputElem.value;
        if (relations.relationBase[relaName]) {
            s('.add').innerHTML = bv.getLang('basicView > relation.modify'); // 更改按钮文字为编辑
        } else {
            s('.add').innerHTML = bv.getLang('basicView > relation.add'); // 更改按钮文字为添加
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
                let menuLinks = s('.menu a', true);
                for (let i in menuLinks) {
                    let e = menuLinks[i], attr = (typeof e == 'object' ? e.getAttribute('data-src') : null);
                    if (attr) e.addEventListener('click', () => bv.float(attr), false);
                }
                s('#relationName').addEventListener('input', bv.inputExistChecker, false);
            })
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
        fl.style.zIndex = 50;
        fl.style.opacity = 1;
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
        let bv = basicView;
        basicView.float("relationView", (resp) => bv.langRender("relationView", resp));
    },
    float: function (html) {
        let tl = s('.relationLayer'), tc = s('.relationContent');
        tc.innerHTML = html;
        tl.style.zIndex = 52;
        tl.style.opacity = 1;
    },
    closeFloat: function () {
        let tl = s('.relationLayer');
        tl.style.opacity = 0;
        basicView.motionChecker(tl, () => {
            tl.style.zIndex = -1;
        });
    },
    modify: async function () {
        let tv = this,
            bv = basicView,
            localTp = tv.relaTemplate,
            rsTp = Promise.resolve(localTp),
            tHtml = await (localTp ? rsTp : fetch("./pages/relationModify.html")
                .then(resp => bv.fHook(resp).text()).catch((e) => {
                    bv.notice(bv.getLang('notice > relation.modifyPageLoadFailed'), true);
                    throw e;
                })
            );
        tv.relaTemplate = tHtml;
        tv.float(tHtml);
    },
    addRela: function () { // 添加关系表
        let bv = basicView,
            noticeLang = bv.currentLang['notice'],
            csvContent = s('#csvForm').value,
            nameInput = s('#relationName'),
            name = nameInput.value.trim(), // 获得关系表名
            parsed = relations.parseCsv(csvContent); // 解析CSV为数组
        if (name.notEmpty()) {
            relations.write(name, parsed).then(res => {
                bv.inputExistChecker(nameInput);
                bv.notice(bv.getLang('notice > ' + res));
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