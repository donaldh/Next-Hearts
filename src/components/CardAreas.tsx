import { memo, useCallback, useMemo } from 'react'

import { CardArea } from 'components/CardArea'

import { Player, getNextPlayer, getPreviousPlayer } from 'models/player'
import { Animation, localPlayerArea } from 'pages'

export const CardAreas = memo(function CardAreas({
	players,
	localPlayer,
	animation,
	playerToStartNextTurn,
}: {
	players: Player[]
	localPlayer?: Player
	animation?: Animation
	playerToStartNextTurn?: string
}) {
	const getPlayer = useCallback(
		(position: number) => {
			let p: Player | undefined

			if (position === 0) p = localPlayer
			else if (position === 1) {
				p = getNextPlayer(players, localPlayer)
			}
			else if (position === 2) {
				p = getNextPlayer(players, getNextPlayer(players, localPlayer))
			}
			else if (position === 3) {
				p = getNextPlayer(players, getNextPlayer(players, getNextPlayer(players, localPlayer)))
			}

			return {
				position,
				player: p,
			}
		},
		[players, localPlayer]
	)

	const getPosition = useCallback(
		(playerPublicID?: string): number => {
			const player = players.find((p) => p.publicID === playerPublicID)
			const previousPlayer = getPreviousPlayer(players, localPlayer)
			const nextPlayer = getNextPlayer(players, localPlayer)
			if (player === localPlayer) return 0
			if (player === nextPlayer) {
				return 1
			}
			if (player === previousPlayer) {
				return 2
			}

			return 2
		},
		[players, localPlayer]
	)

	const nextPlayerPosition = useMemo(
		() => (animation === 'get-cards' ? getPosition(playerToStartNextTurn) : undefined),
		[playerToStartNextTurn, animation, getPosition]
	)

	const animationData = useMemo(
		() => ({
			animation,
			animateToPosition: nextPlayerPosition,
		}),
		[animation, nextPlayerPosition]
	)

	return (
		<>
		{players.map((_, index) => (
			index === 0
			? <CardArea key={index} animationData={animationData} playerData={getPlayer(index)} id={localPlayerArea}/>
			: <CardArea key={index} animationData={animationData} playerData={getPlayer(index)}/>
		))}
		</>
	)
})
