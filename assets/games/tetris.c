/*
 * 俄罗斯方块（简单版）
 * 只用到：基本类型、分支、循环、数组、函数、指针。
 *
 * 编译：gcc -o tetris tetris.c
 * 操作：A / ← 左移，D / → 右移，S / ↓ 加速下落，W / ↑ 旋转，Q 退出
 *
 * 说明：_kbhit() 和 _getch() 来自 conio.h，作用是"不等回车就能读按键"，
 *       只能在 Windows 下用（MinGW 和 MSVC 都带这个头文件）。
 */

#include <stdio.h>
#include <stdlib.h>
#include <conio.h>      /* _kbhit() 看有没有按键，_getch() 读一个按键 */
#include <windows.h>    /* 用 Sleep() 控制下落速度 */
#include <time.h>

#define ROWS 20         /* 场地 20 行 */
#define COLS 10         /* 场地 10 列 */

int board[ROWS][COLS];  /* 已经落定的方块：0 空，1 有方块 */
int cur[4][4];          /* 当前正在下落的方块，用 4x4 表示，1 表示有方块 */
int px, py;             /* 当前方块左上角在场地里的位置 */
int score, lines;       /* 得分和消掉的行数 */
int over;               /* 0 还在玩，1 结束 */

/* 7 种方块各用一个 4x4 的初始形状表示 */
int shapes[7][4][4] = {
    {   /* I 长条 */
        {0, 0, 0, 0},
        {1, 1, 1, 1},
        {0, 0, 0, 0},
        {0, 0, 0, 0}
    },
    {   /* O 方块 */
        {1, 1, 0, 0},
        {1, 1, 0, 0},
        {0, 0, 0, 0},
        {0, 0, 0, 0}
    },
    {   /* T 形 */
        {0, 1, 0, 0},
        {1, 1, 1, 0},
        {0, 0, 0, 0},
        {0, 0, 0, 0}
    },
    {   /* S 形 */
        {0, 1, 1, 0},
        {1, 1, 0, 0},
        {0, 0, 0, 0},
        {0, 0, 0, 0}
    },
    {   /* Z 形 */
        {1, 1, 0, 0},
        {0, 1, 1, 0},
        {0, 0, 0, 0},
        {0, 0, 0, 0}
    },
    {   /* J 形 */
        {1, 0, 0, 0},
        {1, 1, 1, 0},
        {0, 0, 0, 0},
        {0, 0, 0, 0}
    },
    {   /* L 形 */
        {0, 0, 1, 0},
        {1, 1, 1, 0},
        {0, 0, 0, 0},
        {0, 0, 0, 0}
    }
};


/* 把当前方块放到以第 r 行、第 c 列为左上角的位置，能不能放得下
   （注意：r 是行，对应 py；c 是列，对应 px） */
int can_put(int r, int c)
{
    int i, j;

    for (i = 0; i < 4; i++) {
        for (j = 0; j < 4; j++) {
            if (cur[i][j] == 1) {
                int rr = r + i;      /* 这个格子对应场地里的行列 */
                int cc = c + j;

                if (cc < 0 || cc >= COLS)
                    return 0;        /* 出左右边界 */
                if (rr >= ROWS)
                    return 0;        /* 掉出下边界 */
                if (rr >= 0 && board[rr][cc] == 1)
                    return 0;        /* 撞到已经落定的方块 */
            }
        }
    }
    return 1;                        /* 能放下 */
}


/* 随机换一个新方块，放在场地顶部中间 */
void new_piece(void)
{
    int t = rand() % 7;
    int i, j;

    for (i = 0; i < 4; i++)
        for (j = 0; j < 4; j++)
            cur[i][j] = shapes[t][i][j];

    px = COLS / 2 - 2;
    py = 0;

    if (can_put(py, px) == 0)        /* 一出来就放不下，游戏结束 */
        over = 1;
}


/* 顺时针旋转 90 度：新的 cur[i][j] 等于旧的 cur[3-j][i] */
void rotate_piece(void)
{
    int tmp[4][4];
    int i, j;

    for (i = 0; i < 4; i++)
        for (j = 0; j < 4; j++)
            tmp[i][j] = cur[i][j];

    for (i = 0; i < 4; i++)
        for (j = 0; j < 4; j++)
            cur[i][j] = tmp[3 - j][i];

    if (can_put(py, px) == 0) {      /* 转完放不下，就转回去 */
        for (i = 0; i < 4; i++)
            for (j = 0; j < 4; j++)
                cur[i][j] = tmp[i][j];
    }
}


/* 把当前方块固定到场地里 */
void lock_piece(void)
{
    int i, j;

    for (i = 0; i < 4; i++)
        for (j = 0; j < 4; j++)
            if (cur[i][j] == 1 && py + i >= 0)
                board[py + i][px + j] = 1;
}


/* 消掉排满的行，返回一共消了几行 */
int clear_lines(void)
{
    int i, j, k, n = 0, full;

    for (i = ROWS - 1; i >= 0; i--) {
        full = 1;
        for (j = 0; j < COLS; j++)
            if (board[i][j] == 0)
                full = 0;
        if (full == 0)
            continue;

        n++;
        for (k = i; k > 0; k--)              /* 上面的行整体往下挪 */
            for (j = 0; j < COLS; j++)
                board[k][j] = board[k - 1][j];
        for (j = 0; j < COLS; j++)           /* 最上面一行清空 */
            board[0][j] = 0;

        i++;                                 /* 挪下来的这行还要再检查一次 */
    }
    return n;
}


/* (r,c) 这个格子现在是不是当前方块的一部分 */
int in_cur(int r, int c)
{
    int i = r - py;
    int j = c - px;

    if (i < 0 || i > 3 || j < 0 || j > 3)
        return 0;
    return cur[i][j];
}


/* 画场地 */
void draw(void)
{
    int i, j;

    system("cls");
    printf("得分: %d    消行: %d    操作: A D 移动，W 旋转，S 加速，Q 退出\n", score, lines);

    printf("+");
    for (j = 0; j < COLS; j++)
        printf("--");
    printf("+\n");

    for (i = 0; i < ROWS; i++) {
        printf("|");
        for (j = 0; j < COLS; j++) {
            if (board[i][j] == 1 || in_cur(i, j))
                printf("[]");
            else
                printf(" .");
        }
        printf("|\n");
    }

    printf("+");
    for (j = 0; j < COLS; j++)
        printf("--");
    printf("+\n");
}


/* 方块落定：固定、消行、再换新方块 */
void lock_and_next(void)
{
    int n;

    lock_piece();
    n = clear_lines();
    if (n > 0) {
        score += n * 10;
        lines += n;
    }
    new_piece();
}


int main(void)
{
    int key;
    int tick = 0;            /* 累计等待的时间 */
    int speed = 500;         /* 每 500 毫秒自动往下一格 */

    system("chcp 65001 > nul");      /* 让控制台按 UTF-8 显示中文 */
    srand((unsigned)time(NULL));     /* 用时间当随机种子 */

    score = 0;
    lines = 0;
    over = 0;
    new_piece();
    draw();

    while (over == 0) {
        if (_kbhit()) {              /* 有按键就立刻处理 */
            key = _getch();
            if (key == 0 || key == 224) {    /* 方向键会先返回 224 */
                key = _getch();
                if (key == 75) key = 'a';
                else if (key == 77) key = 'd';
                else if (key == 80) key = 's';
                else if (key == 72) key = 'w';
            }

            if (key == 'q' || key == 'Q')
                break;

            if ((key == 'a' || key == 'A') && can_put(py, px - 1)) {
                px--;                /* 左移 */
                draw();
            } else if ((key == 'd' || key == 'D') && can_put(py, px + 1)) {
                px++;                /* 右移 */
                draw();
            } else if (key == 'w' || key == 'W') {
                rotate_piece();      /* 旋转 */
                draw();
            } else if (key == 's' || key == 'S') {
                if (can_put(py + 1, px)) {
                    py++;            /* 加速下落一格 */
                    tick = 0;
                    draw();
                }
            }
        }

        Sleep(30);
        tick += 30;

        if (tick >= speed) {         /* 时间到，自动下落一格 */
            tick = 0;
            if (can_put(py + 1, px)) {
                py++;
            } else {
                lock_and_next();     /* 下不去了就落定 */
            }
            if (over != 0)
                break;
            draw();
        }
    }

    draw();
    printf("\n游戏结束！得分：%d，共消掉 %d 行。\n", score, lines);
    printf("按任意键退出...\n");
    _getch();
    return 0;
}
