/*
 * 扫雷（简单版）
 * 只用到：基本类型、分支、循环、数组、函数、指针。
 *
 * 编译运行：  gcc -o minesweeper minesweeper.c
 *
 * 操作：输入 "行 列" 翻开，例如 2 3
 *       输入 "f 行 列" 插旗或取消旗子
 *       输入 "q" 退出
 */

#include <stdio.h>
#include <stdlib.h>
#include <time.h>

/*
 * 执行轨迹（给站点上的"终端回放"用，不影响游戏本身）
 *
 * 只有加 -DTRACE 编译时 TR() 才会往 stdout 吐一个"当前行号"标记：
 *     gcc -DTRACE -o minesweeper.trace minesweeper.c
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

#define MAX 16        /* 棋盘最大 16 x 16 */

#define HIDDEN 0      /* 没翻开 */
#define SHOWN  1      /* 已翻开 */
#define FLAG   2      /* 插了旗 */

int rows = 9;         /* 实际行数 */
int cols = 9;         /* 实际列数 */
int mine_num = 10;    /* 雷数 */

int mine[MAX][MAX];   /* 1 表示这个格子有雷，0 表示没有 */
int view[MAX][MAX];   /* 每个格子的状态：HIDDEN / SHOWN / FLAG */

int flags = 0;        /* 已经插了几面旗 */
int opened = 0;       /* 已经翻开了几个格子 */
int over = 0;         /* 0 继续玩，1 赢了，2 输了 */


/* 把两块棋盘清空。用指针来遍历二维数组。 */
void init(void)
{
    int *m = &mine[0][0];     /* m 指向 mine[0][0]，可以像一维数组那样用 */
    int *v = &view[0][0];
    int i;

    for (i = 0; i < MAX * MAX; i++) {
        m[i] = 0;
        v[i] = HIDDEN;
    }

    flags = 0;
    opened = 0;
    over = 0;
}


/* 数一数 (r,c) 周围 8 个格子里有几颗雷 */
int count_mine(int r, int c)
{
    int dr, dc, n = 0;

    for (dr = -1; dr <= 1; dr++) {
        for (dc = -1; dc <= 1; dc++) {
            int rr = r + dr;
            int cc = c + dc;

            if (rr < 0 || rr >= rows || cc < 0 || cc >= cols)
                continue;                 /* 越界的格子跳过 */
            if (mine[rr][cc] == 1)
                n++;
        }
    }
    return n;
}


/* 第一次翻开之后才布雷，(sr,sc) 及其周围 8 格不放雷 */
void put_mines(int sr, int sc)
{
    int r, c, placed = 0;

    while (placed < mine_num) {
        r = rand() % rows;
        c = rand() % cols;

        if (mine[r][c] == 1)                 /* 这里已经有雷了 */
            continue;
        if (r >= sr - 1 && r <= sr + 1 && c >= sc - 1 && c <= sc + 1)
            continue;                        /* 这是第一次点击的附近，不放雷 */

        mine[r][c] = 1;
        placed++;
    }
}


/* 翻开一个格子；如果是空格子，就用递归把周围一起翻开 */
void open_cell(int r, int c)
{
    if (r < 0 || r >= rows || c < 0 || c >= cols)
        return;
    if (view[r][c] != HIDDEN || mine[r][c] == 1)
        return;

    view[r][c] = SHOWN;
    opened++;

    if (count_mine(r, c) > 0)      /* 周围有雷，只翻开自己 */
        return;

    /* 周围没有雷，相邻的 8 格也翻开 */
    open_cell(r - 1, c - 1);
    open_cell(r - 1, c);
    open_cell(r - 1, c + 1);
    open_cell(r, c - 1);
    open_cell(r, c + 1);
    open_cell(r + 1, c - 1);
    open_cell(r + 1, c);
    open_cell(r + 1, c + 1);
}


/* 打印棋盘 */
void show(void)
{
    int r, c;

    /* 一帧的起点。站点按"这一行"把 stdout 切开，所以它必须是 show() 里
       第一条真正执行的语句 —— 切出来的每一段就正好是一块棋盘。 */
    TR();

    printf("\n     ");
    for (c = 0; c < cols; c++)
        printf("%2d", c + 1);          /* 列号 */
    printf("\n");

    for (r = 0; r < rows; r++) {
        printf("%3d  ", r + 1);        /* 行号 */
        for (c = 0; c < cols; c++) {
            if (view[r][c] == FLAG)
                printf(" F");
            else if (view[r][c] == HIDDEN)
                printf(" #");
            else if (mine[r][c] == 1)
                printf(" *");          /* 雷 */
            else if (count_mine(r, c) == 0)
                printf(" .");          /* 周围没雷的空格 */
            else
                printf(" %d", count_mine(r, c));
        }
        printf("\n");
    }

    printf("剩余雷数（雷数 - 旗数）：%d\n", mine_num - flags);
}


int main(void)
{
    char line[100];
    char cmd[20];
    int r, c;
    int level, first = 1;      /* first 为 1 表示还没翻开过任何格子 */

    srand((unsigned)time(NULL));   /* 用时间做随机种子 */

    printf("选择难度：1-初级(9x9, 10雷)  2-中级(16x16, 40雷)  [默认 1]：");
    fgets(line, sizeof line, stdin);
    level = atoi(line);
    if (level == 2) {
        rows = 16;
        cols = 16;
        mine_num = 40;
    }

    init();
    show();

    while (over == 0) {
        printf("\n输入（行 列 / f 行 列 / q 退出）：");
        if (fgets(line, sizeof line, stdin) == NULL)
            break;                          /* 按 Ctrl+Z / Ctrl+D 结束 */
        if (sscanf(line, "%19s", cmd) != 1)
            continue;
        if (cmd[0] == 'q')
            break;

        if (cmd[0] == 'f') {                /* 插旗 */
            if (sscanf(line, "%*s %d %d", &r, &c) != 2) {
                printf("格式不对，插旗请输入：f 行 列\n");  TR();
                continue;
            }
        } else {                            /* 翻开 */
            if (sscanf(line, "%d %d", &r, &c) != 2) {
                printf("格式不对，翻开请输入：行 列\n");  TR();
                continue;
            }
        }

        r--;                                /* 玩家输入从 1 开始，数组从 0 开始 */
        c--;
        if (r < 0 || r >= rows || c < 0 || c >= cols) {
            printf("坐标超出范围，行是 1-%d，列是 1-%d\n", rows, cols);  TR();
            continue;
        }

        if (cmd[0] == 'f') {
            if (view[r][c] == SHOWN) {
                printf("这个格子已经翻开了，不能插旗\n");  TR();
                continue;
            }
            if (view[r][c] == FLAG) {
                view[r][c] = HIDDEN;        /* 再按一次取消旗子 */
                flags--;  TR();
            } else {
                view[r][c] = FLAG;
                flags++;  TR();
            }
        } else {
            if (view[r][c] == FLAG) {
                printf("这个格子插着旗，先取消旗子再翻开\n");  TR();
                continue;
            }
            if (view[r][c] == SHOWN) {
                printf("这个格子已经翻开了\n");  TR();
                continue;
            }

            if (first == 1) {               /* 第一次点击才布雷，保证不会一上来就踩雷 */
                put_mines(r, c);  TR();
                first = 0;
            }

            if (mine[r][c] == 1) {
                over = 2;  TR();            /* 踩雷 */
            } else {
                open_cell(r, c);  TR();
                /* 这里必须补花括号：TR() 是语句，不补的话它会**无条件**执行，
                   回放里就会显示"赢了"这条根本没走到的分支。 */
                if (opened == rows * cols - mine_num) {
                    over = 1;  TR();        /* 不是雷的格子全翻开了，赢 */
                }
            }
        }

        show();
    }

    if (over == 1) {
        printf("\n恭喜，你把所有的雷都找出来了！\n");  TR();
    } else if (over == 2) {
        for (r = 0; r < rows; r++)          /* 输了就把雷都显示出来 */
            for (c = 0; c < cols; c++)
                if (mine[r][c] == 1)
                    view[r][c] = SHOWN;
        printf("\n   ...踩到雷了，游戏结束：\n");  TR();
        show();
    }

    return 0;
}
