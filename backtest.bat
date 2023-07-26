@echo off

echo 'start' > test.log
REM strategy
FOR /L %%B IN (0,1,0) DO (
  REM params
  FOR /L %%A IN (0,1,7) DO (
    REM period
    FOR /L %%C IN (1,1,3) DO (
      pnpm run backtest %%A %%B %%C >> test.log
    )
  )
)
