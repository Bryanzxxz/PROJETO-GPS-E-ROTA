@echo off
title Servidor Guarutoner Rastreamento
color 0B

echo ========================================================
echo        PLATAFORMA GUARUTONER - ROTAS E RASTREAMENTO
echo ========================================================
echo.
echo NOTA: Mantenha esta janela preta aberta para que 
echo o sistema dos tecnicos continue fucionando no ar!
echo.
echo Iniciando o servidor... Localizando dependencias...
echo.

cd "%~dp0backend"

:: Inicia o painel no navegador automaticamente assim que possivel
start "" "http://localhost:3000"

:: Executa a base do Node (isso segurara a tela aberta mostrando os logs)
node server.js

pause
