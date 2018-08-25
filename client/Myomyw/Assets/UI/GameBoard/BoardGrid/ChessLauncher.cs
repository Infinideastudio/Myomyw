using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace UI.GameBoard.BoardGrid
{
    public sealed class ChessLauncher : Button
    {   
        public override void OnPointerDown(PointerEventData eventData)
        {
            base.OnPointerDown(eventData);
            if (!IsPressed()) return;
            _isLaunching = true;
            _lastUpdation = DateTime.Now;
        }

        public override void OnPointerUp(PointerEventData eventData)
        {
            base.OnPointerUp(eventData);
            _isLaunching = false;
        }

        public void Setup(int launch, ChessBoardGrid grid)
        {
            _launcher = launch;
            _grid = grid;
        }

        private void Update()
        {
            if (!_isLaunching) return;
            if ((DateTime.Now - _lastUpdation).TotalMilliseconds <= 1000) return;
            _lastUpdation = DateTime.Now;
            _grid.LaunchChess(_launcher);
        }

        private ChessBoardGrid _grid;

        private DateTime _lastUpdation;

        private bool _isLaunching;

        private int _launcher;
    }
}