'use strict';

Date.prototype.getThisDay = function()
{
    var date = new Date();
    return [date.setHours(0,0,0,0), date.setHours(23,59,59,999)];
}

Date.prototype.getWeek = function()
{
    var curr = new Date(this.setHours(0, 0, 0, 0));
    var firstday = new Date(curr.setDate(curr.getDate() - curr.getDay()));
	var lastday = new Date(curr.setDate(curr.getDate() - curr.getDay()+6));
	lastday = new Date(lastday.setHours(23, 59, 59, 0))
    return [firstday, lastday];
}

angular.module('mean.icu.ui.entityListFilters', [])
.filter('filterRecycled', function (EntityService,$state) {
	return function(entities) {
		if($state.current.name === "main.search.recycled") return entities ;
		if (!entities || !(entities instanceof Array)) return entities;
		let out = entities.filter(entity => !entity.recycled);
		return out;
	}
})
.filter('filterByActiveStatus', function (EntityService) {
	return function(entities,type) {
		if (!entities || !(entities instanceof Array) || !EntityService.isActiveStatusAvailable()) return entities;
		//if (!type) {
// 		type = { entity: type };
		//}
		var filterValue = EntityService.activeStatusFilterValue;
		var out = [];
		switch (filterValue) {
			default:
				out = entities.filter(entity => {
					if (!entity.hasOwnProperty('status')) {
						return true;
					}
					switch(type) {
						case 'all':
							return true;
							break;
						case 'active':
							return  ['new', 'assigned', 'in-progress', 'review'].includes(entity.status);
							break;
						case 'nonactive':
							return  ['rejected', 'done', 'archived', 'canceled', 'done'].includes(entity.status);
							break;
					}
					return true;
				});
		}
		return out;
	};
});
