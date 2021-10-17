'use strict';
var s = (selector) => document.querySelector(selector);/*简化一下选择器*/
/*在字符串原型链上加个提取模板占位名的方法*/
String.prototype.exactTp = function () {
    return this.replace('{[', '').replace(']}', '');
}
/*在字符串原型链上加个寻找模板占位符的方法*/
String.prototype.findTp = function () {
    return this.match(new RegExp('\\{\\[(\\S*)\\]\\}', 'gi'));
}
var basicView = {
    langList: {},
    currentLang: {},
    originalTemplates: '',
    motionChecker: function (element, func, checkAnim = false) {/*CSS3运动结束监听回调器(监听元素,回调函数,监听的是不是css3Animation)*/
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
            s('.notice span').style.float = 'left';
            s('.notice a').style.display = 'block';
        })
    },
    notice: function (content, needConfirm = false) { /*弹出提示(提示内容,是否要用户确认)*/
        let noticer = s('.notice'), that = this;
        noticer.style.transform = 'translateY(0)';
        s('.notice span').innerHTML = content;
        if (!needConfirm) {
            s('.notice span').style.float = 'initial';
            s('.notice a').style.display = 'none';
        }
        this.motionChecker(noticer, () => {
            if (!needConfirm) setTimeout(that.closeNotice, 1500);
        })
    },
    init: function () {
        /*最先拉取语言*/
        let bv = this;
        fetch('./lang/index.json')
            .then((resp) => resp.json())
            .then((resp) => {
                localStorage.RAchosenLang = localStorage.RAchosenLang || resp.defaultLang;
                /*载入语言列表*/
                bv.langList = resp.langList;
                /*选定语言*/
                let chosenLang = localStorage.RAchosenLang;
                console.log('Choose Language:' + bv.langList[chosenLang]);
                return fetch('./lang/' + chosenLang + '.json');
            })
            .then((langResp) => langResp.json())
            .then((langResp) => {
                let basicView = s('.basicView'), basicViewTemplate = bv.originalTemplates || basicView.innerHTML;
                /*储存本来的容器模板，以后还有用*/
                bv.originalTemplates = basicViewTemplate;
                /*获得选择的语言对应的配置文件*/
                bv.currentLang = langResp;
                /*找出所有的替换符号*/
                let matches = basicViewTemplate.findTp(), viewLang = langResp.theView;
                for (var i in matches) {
                    /*获得模板占位名*/
                    let theHolder = matches[i].exactTp();

                }
            })
            .catch(error => {
                bv.notice('Language config load failed.Please contact SomeBottle', true);
                console.error(error);
            })
    }
}