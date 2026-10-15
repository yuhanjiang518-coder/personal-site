/*
 * 贪吃蛇（简单版）
 * 只用到：基本类型、分支、循环、数组、函数、指针。
 *
 * 编译：gcc -o snake snake.c
 * 操作：W A S D 或方向键控制方向，Q 退出
 *
 * 说明：_kbhit() 和 _getch() 来自 conio.h，作用是"不等回车就能读按键"，
 *       只能在 Windows 下用（MinGW 和 MSVC 都带这个头文件）。
 */

#include <stdio.h>
#include <stdlib.h>
#include <conio.h>      /* _kbhit() 看有没有按键，_getch() 读一个按键 */
#include <windows.h>    /* 用 Sleep() 控制蛇的速度 */
#include <time.h>

/*
 * 执行轨迹（给站点上的"终端回放"用，不影响游戏本身）
 *
 * 只有加 -DTRACE 编译时 TR() 才会往 stdout 吐一个"当前行号"标记：
 *     gcc -DTRACE -o snake.trace snake.c
 * 不加的时候（也就是上面那行编译命令）TR() 展开成空语句，二进制里
 * 一点痕迹都没有，游戏行为完全一致。
 *
 * 为什么标记要挤在真正干活的那一行末尾：站点把每一帧 stdout 和这些
 * 标记对上，回放到那一帧时就高亮那一行的源码。标记写在哪一行，
 * 观众看到的就是哪一行 —— 所以它必须和那句代码同行，才有得读。
 *
 * 为什么每次都要 fflush：stdout 重定向到文件时是块缓冲的，
 * 不冲一下，标记会和它后面那些行挤在一起晚到，帧和行号就对不上了。
 */
#ifdef TRACE
#define TR() do { printf("\x01%ld\n", (long)__LINE__); fflush(stdout); } while (0)
#else
#define TR() ((void)0)
#endif

#define W 20            /* 场地宽 20 格 */
#define H 20            /* 场地高 20 格 */
#define MAXLEN (W * H)  /* 蛇最长占满整个场地 */

int body_x[MAXLEN];     /* 蛇身每一节的横坐标，body_x[0] 是蛇头 */
int body_y[MAXLEN];     /* 蛇身每一节的纵坐标 */
int len;                /* 蛇的长度 */
int food_x, food_y;     /* 食物的坐标 */
int dir;                /* 方向：0 上，1 右，2 下，3 左 */
int score;              /* 得分 */
int over;               /* 0 还在玩，1 撞死了，2 通关了 */


/* 看看 (x,y) 是不是蛇身前 n 节里的某一节 */
int hit_body(int x, int y, int n)
{
    int i;
    for (i = 0; i < n; i++)
        if (body_x[i] == x && body_y[i] == y)
            return 1;
    return 0;
}


/* 随机放一个食物，不能放在蛇身上 */
void put_food(void)
{
    do {
        food_x = rand() % W;
        food_y = rand() % H;
    } while (hit_body(food_x, food_y, len));
}


/* 游戏开始：蛇长 3 节，放在场地中间，朝右走 */
void init_game(void)
{
    len = 3;
    body_x[0] = W / 2;       body_y[0] = H / 2;
    body_x[1] = W / 2 - 1;   body_y[1] = H / 2;
    body_x[2] = W / 2 - 2;   body_y[2] = H / 2;
    dir = 1;
    score = 0;
    over = 0;
    put_food();
}


/* 改方向：参数用指针，直接改调用者的 dir 变量 */
void change_dir(int *d, int key)
{
    if (key == 'w' || key == 'W') { if (*d != 2) *d = 0; }   /* 不能直接掉头 */
    if (key == 'd' || key == 'D') { if (*d != 3) *d = 1; }
    if (key == 's' || key == 'S') { if (*d != 0) *d = 2; }
    if (key == 'a' || key == 'A') { if (*d != 1) *d = 3; }
}


/* 蛇往前爬一格 */
void step(void)
{
    int nx = body_x[0];          /* 先算出新蛇头的位置 */
    int ny = body_y[0];
    int i, eat;

    if (dir == 0) ny--;
    else if (dir == 1) nx++;
    else if (dir == 2) ny++;
    else nx--;

    if (nx < 0 || nx >= W || ny < 0 || ny >= H) {   /* 撞墙 */
        over = 1;  TR();
        return;
    }

    eat = (nx == food_x && ny == food_y);

    /* 没吃到东西时尾巴会往前让一格，所以最后一节不算撞到自己 */
    if (hit_body(nx, ny, eat ? len : len - 1)) {
        over = 1;  TR();
        return;
    }

    if (eat == 1) {
        len++;  TR();                /* 吃到食物，长度加一 */
    }

    for (i = len - 1; i > 0; i--) {  /* 身体每一节都往前挪一格 */
        body_x[i] = body_x[i - 1];
        body_y[i] = body_y[i - 1];
    }
    body_x[0] = nx;  TR();           /* 蛇头放到新位置 */
    body_y[0] = ny;

    if (eat == 1) {
        score += 10;
        if (len == MAXLEN) {         /* 整块场地都是蛇，通关 */
            over = 2;  TR();
            return;
        }
        put_food();
    }
}


/* 把场地画出来 */
void draw(void)
{
    int x, y;

    /* 一帧的起点。站点按"这一行"把 stdout 切开，所以它必须是 draw() 里
       第一条真正执行的语句 —— 切出来的每一段就正好是一幅场地。 */
    TR();

    system("cls");                   /* 清屏，重新画一整幅 */
    printf("得分: %d    长度: %d    操作: W A S D / 方向键，Q 退出\n", score, len);

    printf("+");
    for (x = 0; x < W; x++)
        printf("--");
    printf("+\n");

    for (y = 0; y < H; y++) {
        printf("|");
        for (x = 0; x < W; x++) {
            if (x == body_x[0] && y == body_y[0])
                printf("@@");                    /* 蛇头 */
            else if (hit_body(x, y, len))
                printf("##");                    /* 蛇身 */
            else if (x == food_x && y == food_y)
                printf("**");                    /* 食物 */
            else
                printf("  ");
        }
        printf("|\n");
    }

    printf("+");
    for (x = 0; x < W; x++)
        printf("--");
    printf("+\n");
}


int main(void)
{
    int key;

    system("chcp 65001 > nul");      /* 让控制台按 UTF-8 显示中文 */
    srand((unsigned)time(NULL));     /* 用时间当随机种子 */
    init_game();

    while (1) {
        if (_kbhit()) {              /* 有按键就处理 */
            key = _getch();
            if (key == 0 || key == 224) {    /* 方向键会先返回 224，再返回一个码 */
                key = _getch();
                if (key == 72) key = 'w';
                else if (key == 77) key = 'd';
                else if (key == 80) key = 's';
                else if (key == 75) key = 'a';
            }
            if (key == 'q' || key == 'Q')
                break;
            change_dir(&dir, key);           /* 把 dir 的地址传进去 */
        }

        step();  TR();
        draw();
        if (over != 0)
            break;
        Sleep(150);                  /* 停 150 毫秒，也就是每秒爬 6 格多 */
    }

    /* 这里必须补花括号：TR() 哪怕展开成空语句也是一个**语句**，
       `if (over == 1) printf(...); TR(); else ...` 会让 else 找不到 if。 */
    if (over == 1) {
        printf("\n游戏结束！得分：%d\n", score);  TR();
    } else if (over == 2) {
        printf("\n太厉害了，整块场地都被你占满了！得分：%d\n", score);  TR();
    }

    printf("按任意键退出...\n");
    _getch();
    return 0;
}
