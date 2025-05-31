const https = require('https');
const md5 = require('md5');
const express = require('express');
const session = require('express-session');
const swig = require('swig');
const bodyParser = require('body-parser');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const functions = require('./functions');
const router = require('./routes/router');

// functions.js에서 필요한 함수/변수 구조분해 할당
const {
    skinList,
    getUserSetting,
    toDate,
    generateTime,
    ip_check,
    rndval,
    wikiconfig,
    permlist,
    userset,
    neededPages,
    fetchNamespaces,
    getTime,
    aclgroupCache,
    beep
} = functions;

async function init() {
    const { curs } = require('./database');
    
    console.log('병아리 - the seed 모방 엔진에 오신것을 환영합니다.\n');
    
    // 호스팅 설정
    var hostconfig = {
        host: input('호스트 주소: '),
        port: input('포트 번호: '),
        skin: input('기본 스킨 이름: '),
        search_host: '127.5.5.5',
        search_port: '25005',
        file_host: '127.5.5.5',
        file_port: '27775',
        disable_file_server: true,
        owners: [input('소유자 닉네임: ')],
        disable_email: true,
        sessionhttps: false,
    };
    
    const tables = {
        'documents': ['title', 'content', 'namespace', 'time'],
        'history': ['title', 'namespace', 'content', 'rev', 'time', 'username', 'changes', 'log', 'iserq', 'erqnum', 'advance', 'ismember', 'edit_request_id', 'flags', 'isapi', 'loghider', 'marktroller', 'hider'],
        'namespaces': ['namespace', 'locked', 'norecent', 'file'],
        'users': ['username', 'password', 'email'],
        'user_settings': ['username', 'key', 'value'],
        'nsacl': ['namespace', 'no', 'type', 'content', 'action', 'expire'],
        'config': ['key', 'value'],
        'email_filters': ['address'],
        'stars': ['title', 'namespace', 'username', 'lastedit'],
        'perms': ['perm', 'username'],
        'threads': ['title', 'namespace', 'topic', 'status', 'time', 'tnum', 'deleted', 'num'],
        'res': ['id', 'content', 'username', 'time', 'hidden', 'hider', 'status', 'tnum', 'ismember', 'isadmin', 'type'],
        'useragents': ['username', 'string'],
        'login_history': ['username', 'ip', 'time'],
        'account_creation': ['key', 'email', 'time'],
        'acl': ['title', 'namespace', 'id', 'type', 'action', 'expiration', 'conditiontype', 'condition', 'ns'],
        'ipacl': ['cidr', 'al', 'expiration', 'note', 'date'],
        'suspend_account': ['username', 'date', 'expiration', 'note'],
        'aclgroup_groups': ['name', 'admin', 'date', 'lastupdate', 'css', 'warning_description', 'disallow_signup'],
        'aclgroup': ['aclgroup', 'type', 'username', 'note', 'date', 'expiration', 'id'],
        'block_history': ['date', 'type', 'aclgroup', 'id', 'duration', 'note', 'executer', 'target', 'ismember', 'logid'],
        'edit_requests': ['title', 'namespace', 'id', 'deleted', 'state', 'content', 'baserev', 'username', 'ismember', 'log', 'date', 'processor', 'processortype', 'lastupdate', 'processtime', 'reason', 'rev', 'locker'],
        'files': ['title', 'namespace', 'hash', 'url', 'size', 'width', 'height'],
        'backlink': ['title', 'namespace', 'link', 'linkns', 'type', 'exist'],
        'classic_acl': ['title', 'namespace', 'blockkorea', 'blockbot', 'read', 'edit', 'del', 'discuss', 'move'],
        'autologin_tokens': ['username', 'token'],
        'trusted_devices': ['username', 'id'],
        'api_tokens': ['username', 'token'],
        'recover_account': ['key', 'username', 'email', 'time'],
        'boardipacl': ['cidr', 'expiration', 'note', 'date'],
        'boardsuspendaccount': ['username', 'expiration', 'note', 'date'],
    };
    
    // 테이블 만들기
    process.stdout.write('\n데이타베이스 테이블을 만드는 중... ');
    for(var table in tables) {
        var sql = '';
        sql = `CREATE TABLE ${table} ( `;
        for(var col of tables[table]) {
            sql += `${col} TEXT DEFAULT '', `;
        }
        sql = sql.replace(/[,]\s$/, '');		
        sql += `)`;
        await curs.execute(sql);
    }
    console.log('완료!');
    
    process.stdout.write('이름공간 ACL을 만드는 중... ');
    for(var namespc of ['문서', '틀', '분류', '파일', '더 시드']) {
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '1', 'read', 'allow', '0', 'perm', 'any', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '1', 'edit', 'deny', '0', 'aclgroup', '차단된 사용자', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '2', 'edit', 'deny', '0', 'aclgroup', '로그인 허용 차단', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '3', 'edit', 'allow', '0', 'perm', 'any', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '1', 'move', 'deny', '0', 'aclgroup', '차단된 사용자', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '2', 'move', 'deny', '0', 'aclgroup', '로그인 허용 차단', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '3', 'move', 'allow', '0', 'perm', 'any', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '1', 'delete', 'deny', '0', 'aclgroup', '차단된 사용자', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '2', 'delete', 'deny', '0', 'aclgroup', '로그인 허용 차단', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '3', 'delete', 'allow', '0', 'perm', 'any', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '1', 'create_thread', 'deny', '0', 'aclgroup', '차단된 사용자', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '2', 'create_thread', 'deny', '0', 'aclgroup', '로그인 허용 차단', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '3', 'create_thread', 'allow', '0', 'perm', 'any', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '1', 'write_thread_comment', 'deny', '0', 'aclgroup', '차단된 사용자', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '2', 'write_thread_comment', 'deny', '0', 'aclgroup', '로그인 허용 차단', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '3', 'write_thread_comment', 'allow', '0', 'perm', 'any', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '1', 'edit_request', 'deny', '0', 'aclgroup', '차단된 사용자', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '2', 'edit_request', 'deny', '0', 'aclgroup', '로그인 허용 차단', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '3', 'edit_request', 'allow', '0', 'perm', 'any', '1')");
        await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '" + namespc + "', '1', 'acl', 'allow', '0', 'perm', 'admin', '1')");
    }
    
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '1', 'read', 'allow', '0', 'perm', 'any', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '1', 'edit', 'deny', '0', 'aclgroup', '로그인 허용 차단', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '2', 'edit', 'allow', '0', 'perm', 'match_username_and_document_title', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '3', 'edit', 'allow', '0', 'perm', 'editable_other_user_document', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '1', 'move', 'deny', '0', 'aclgroup', '로그인 허용 차단', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '2', 'move', 'allow', '0', 'perm', 'match_username_and_document_title', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '3', 'move', 'allow', '0', 'perm', 'editable_other_user_document', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '1', 'delete', 'deny', '0', 'aclgroup', '로그인 허용 차단', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '2', 'delete', 'allow', '0', 'perm', 'match_username_and_document_title', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '3', 'delete', 'allow', '0', 'perm', 'editable_other_user_document', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '1', 'create_thread', 'deny', '0', 'aclgroup', '차단된 사용자', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '2', 'create_thread', 'deny', '0', 'aclgroup', '로그인 허용 차단', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '3', 'create_thread', 'allow', '0', 'perm', 'any', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '1', 'write_thread_comment', 'deny', '0', 'aclgroup', '차단된 사용자', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '2', 'write_thread_comment', 'deny', '0', 'aclgroup', '로그인 허용 차단', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '3', 'write_thread_comment', 'allow', '0', 'perm', 'any', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '1', 'edit_request', 'deny', '0', 'aclgroup', '차단된 사용자', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '2', 'edit_request', 'deny', '0', 'aclgroup', '로그인 허용 차단', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '3', 'edit_request', 'allow', '0', 'perm', 'any', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '사용자', '1', 'acl', 'allow', '0', 'perm', 'admin', '1')");

    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '휴지통', '1', 'read', 'allow', '0', 'perm', 'admin', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '휴지통', '1', 'edit', 'allow', '0', 'perm', 'admin', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '휴지통', '1', 'move', 'allow', '0', 'perm', 'admin', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '휴지통', '1', 'delete', 'allow', '0', 'perm', 'admin', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '휴지통', '1', 'create_thread', 'allow', '0', 'perm', 'admin', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '휴지통', '1', 'write_thread_comment', 'allow', '0', 'perm', 'admin', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '휴지통', '1', 'edit_request', 'allow', '0', 'perm', 'admin', '1')");
    await curs.execute("INSERT INTO acl (title, namespace, id, type, action, expiration, conditiontype, condition, ns) VALUES ('', '휴지통', '1', 'acl', 'allow', '0', 'perm', 'admin', '1')");

    console.log('완료!');
    
    process.stdout.write('ACL그룹을 만드는 중... ');
    await curs.execute("insert into aclgroup_groups (name, css, warning_description, disallow_signup) values ('차단된 사용자', 'text-decoration: line-through !important; color: gray !important;', '', '1')");
    console.log('완료!');
    
    fs.writeFileSync('config.json', JSON.stringify(hostconfig), 'utf8');
    console.log('\n준비 완료되었습니다. 엔진을 다시 시작하십시오.');
    process.exit(0);
}

if(!fs.existsSync('./config.json')) {
    init();
} else {
const router = require('./routes/router'); // 라우터 설정
const hostconfig = require('./hostconfig');
const wiki = express();  // 기본 서버 설정

functions.cacheSkinList();

// 모듈 사용
wiki.use(bodyParser.json());
wiki.use(bodyParser.urlencoded({ extended: true }));
wiki.use(fileUpload({
    limits: { fileSize: hostconfig.max_file_size || 2000000 },
    abortOnLimit: true,
}));
wiki.use(session({
    key: 'kotori',
    secret: rndval('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 1024),
    cookie: {
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24),
        httpOnly: true,
        secure: hostconfig.sessionhttps,
        samesite: "lax"
    },
    resave: false,
    saveUninitialized: false,
}));
wiki.use(cookieParser());

wiki.use('/images', express.static('images', { maxAge: 86400000 }));

// 보안을 위해...
wiki.disable('x-powered-by');

// swig 필터
swig.setFilter('encode_userdoc', function encodeUserdocURL(input) {
    return encodeURIComponent('사용자:' + input);
});
swig.setFilter('encode_doc', function encodeDocURL(input) {
    return encodeURIComponent(input);
});
swig.setFilter('avatar_url', function(input) {
    return 'https://www.gravatar.com/avatar/' + md5(getUserSetting(input.username, 'email') || '') + '?d=retro';
});
swig.setFilter('md5', function(input, l) {
    return md5(input).slice(0, (l || 33));
});
swig.setFilter('url_encode', function(input) {
    return encodeURIComponent(input);
});
swig.setFilter('to_date', toDate);
swig.setFilter('localdate', generateTime);

// 아이피차단
wiki.all('*', async function(req, res, next) {
    if(hostconfig.block_ip && hostconfig.block_ip.includes(ip_check(req, 1)))
        return;
    next();
});

wiki.get(/^\/skins\/((?:(?!\/).)+)\/(.+)/, async function sendSkinFile(req, res, next) {
    const skinname = req.params[0];
    const filepath = req.params[1];
    
    if(!skinList.includes(skinname))
        return next();
    
    if(decodeURIComponent(filepath).includes('./') || decodeURIComponent(filepath).includes('..')) {
        return next();
    }
    
    try {
        res.sendFile(filepath, { root: './skins/' + skinname + '/static' });
    } catch(e) {
        next();
    }
});

wiki.use('/js', express.static('js', { maxAge: 86400000 }));
wiki.use('/css', express.static('css', { maxAge: 86400000 }));

function redirectToFrontPage(req, res) {
    res.redirect('/w/' + (functions.config?.getString?.('wiki.front_page', 'FrontPage') || 'FrontPage'));
}

wiki.get(/^\/w$/, redirectToFrontPage);
wiki.get(/^\/w\/$/, redirectToFrontPage);
wiki.get('/', redirectToFrontPage);

//if(1) wiki.use('/', require('./frontends/nuxt/frontend')); else
wiki.use('/', router);

// 404 페이지
wiki.use(function(req, res, next) {
    return res.status(404).send(`
<html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>페이지를 찾을 수 없습니다.</title>
        <link rel="stylesheet" href="/skins/haneul-liberty/bootstrap/css/bootstrap.min.css">
        <link rel="stylesheet" href="/skins/haneul-liberty/css/font-awesome.min.css">
        <style>
            section {
                position: fixed;
                top: 0;
                right: 0;
                bottom: 0;
                left: 0;
                padding: 80px 0 0;
                background-color:#EFEFEF;
                font-family: "Open Sans", sans-serif;
                text-align: center;
            }    
            p {
                margin: 0 0 57px;
                font-size: 16px;
                color:#444;
                line-height: 23px;
            }
            h1 {
                margin: .67em 0;
                font-size: 2em;
            }
        </style>
    </head>
    <body style="background-color: #fff;">
        <section style="background-color: #fff;">
            <p style="margin: 0;">
                (로고 파일)
            </p>
                        <h1>
                <b style="color:#87cefa;">
                    404 NOT FOUND
                </b>
            </h1>
            <p style="font-size: 14px;padding: 1px;">
                <b style="font-size: 17px;padding-bottom: 30px;">
                    페이지를 찾을 수 없습니다
                </b><br>
                <span style="margin-top: 10px;">
                    /example 페이지는 없는 페이지입니다.<br>입력하신 URL을 다시 한 번 확인해주시거나,<br>오류일 수 있으니 새로고침해주세요.
                </span>
            </p>
            <p>
                (마스코드 파일)
            </p><br><br><br>
            <button class="btn btn-danger" onclick="history.back()" style="padding: .375rem 1rem;color:#fff;border-color: grey;background-color: grey;font-size: 13px;border: 1px solid transparent;border-radius: .25rem;">
                <b style="font-size: 17px;">
                    <span class="fa fa-refresh"></span> 돌아가기
                </b>
            </button>
            <button class="btn btn-primary" onclick="location.href='/w/'" style="padding: .375rem 1rem;color:#fff;border-color: #87cefa;background-color: #87cefa;font-size: 17px;border: 1px solid transparent;border-radius: .25rem;">
                <b>
                    <span class="fa fa-home"></span> 대문가기
                </b>
            </button>
        </section>
    </body>
</html>
    `);
});

(async function setWikiData() {
    const { curs } = require('./database');
    // 위키 설정 캐시
    var data = await curs.execute("select key, value from config");
    for(var cfg of data) {
        wikiconfig[cfg.key] = cfg.value;
    }
    
    // 권한 캐시
    var data = await curs.execute("select username, perm from perms order by username");
    for(var prm of data) {
        if(typeof(permlist[prm.username]) == 'undefined')
            permlist[prm.username] = [prm.perm];
        else
            permlist[prm.username].push(prm.perm);
    }
    
    // 사용자 설정 캐시
    var data = await curs.execute("select username, key, value from user_settings");
    for(var set of data) {
        if(!userset[set.username]) userset[set.username] = {};
        if(set.key == 'email' && !set.value)
            continue;
        userset[set.username][set.key] = set.value;
    }
    
    // 작성이 필요한 문서
    async function cacheNeededPages() {
        for(var prop of Object.getOwnPropertyNames(neededPages))
            delete neededPages[prop];
        for(var ns of fetchNamespaces()) {
            neededPages[ns] = [];
            var data = await curs.execute("select distinct link from backlink where exist = '0' and linkns = ?", [ns]);
            for(let i of data) {
                neededPages[ns].push(i.link);
            }
        }
    }
    setInterval(cacheNeededPages, 86400000);
    cacheNeededPages();
    
    setInterval(async function clearExpiredAclgroups() {
        var dbdata = await curs.execute("select username, aclgroup from aclgroup where not expiration = '0' and ? > cast(expiration as integer)", [Number(getTime())]);
        for(var item of dbdata) 
            if(aclgroupCache.group[item.username.toLowerCase()])
                aclgroupCache.group[item.username.toLowerCase()].remove(item.aclgroup);
            await curs.execute("delete from aclgroup where not expiration = '0' and ? > cast(expiration as integer)", [Number(getTime())]);
        }, 60000);

    var dbdata = await curs.execute("select name, css from aclgroup_groups");
    for(var item of dbdata)
        aclgroupCache.css[item.name] = item.css;
    var dbdata = await curs.execute("select aclgroup, username from aclgroup");
    for(var item of dbdata) {
        if(!aclgroupCache.group[item.username.toLowerCase()])
            aclgroupCache.group[item.username.toLowerCase()] = [];
        aclgroupCache.group[item.username.toLowerCase()].push(item.aclgroup);
    }
    

    wiki.listen(hostconfig.port, hostconfig.host, () => {
        console.log(`${hostconfig.host}:${hostconfig.port} 에서 실행 중...`);
        beep();
      });
})();

if(hostconfig.self_request) {
    var rq = setInterval(function() {
        https.request({
            host: hostconfig.self_request,
            path: '/RecentDiscuss',
            headers: {
                "Cookie": 'a=1; korori=a; ',
                "Host": hostconfig.self_request,
                "Accept-Encoding": "gzip, deflate",
                "Connection": "keep-alive",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36",
            },
            port: 443,
        }, function(res) {
            var ret = '';

            res.on('data', function(chunk) {
                ret += chunk;
            });

            res.on('end', function() {
            });
        }).end();
    }, (50 + Math.floor(Math.random() * 10)) * 1000);
}
 
}